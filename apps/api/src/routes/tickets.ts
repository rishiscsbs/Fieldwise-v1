import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  MessageInput,
  TicketDetailDto,
  TicketDto,
  TicketInput,
  TicketMessageDto,
  TicketStatusEnum,
} from '@fieldwise/shared';
import { prisma } from '../db.js';
import { canHandleTicket, farmFor, ticketFor, ticketScope } from '../lib/access.js';
import { messageDto, messageInclude, ticketDto, ticketInclude } from '../lib/dto.js';
import { badRequest, forbidden } from '../lib/http.js';
import { IdParams, bearer, errors } from '../lib/route.js';
import type { AccessClaims } from '../plugins/auth.js';
import { notify } from '../services/notify.js';
import { rooms } from '../services/realtime.js';

const tags = ['desk'];

/** First line of the question, trimmed to a readable subject. */
const subjectOf = (body: string) => {
  const line = body.split('\n')[0]!.trim();
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
};

/** Upload ids must belong to the person attaching them. */
async function ownUploads(user: AccessClaims, ids: string[]) {
  if (!ids.length) return [];
  const rows = await prisma.upload.findMany({ where: { id: { in: ids }, ownerId: user.sub } });
  if (rows.length !== new Set(ids).size) throw badRequest('upload_not_yours', 'Attach photos you uploaded');
  return rows;
}

const ticketRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Everyone who should see live changes to a ticket. */
  const audience = (t: { farmerId: string; districtId: string }) => [
    rooms.user(t.farmerId),
    rooms.officers(t.districtId),
  ];

  const loadDto = async (id: string) =>
    ticketDto(await prisma.ticket.findUniqueOrThrow({ where: { id }, include: ticketInclude }));

  app.get(
    '/tickets',
    {
      schema: {
        tags,
        summary: 'Questions you can see, most recently active first',
        description: 'Farmers see their own; officers see their district; admins see all.',
        security: bearer,
        querystring: z.object({
          status: TicketStatusEnum.optional(),
          limit: z.coerce.number().min(1).max(200).default(100),
        }),
        response: { 200: z.array(TicketDto), ...errors },
      },
    },
    async (req) => {
      const rows = await prisma.ticket.findMany({
        where: { ...ticketScope(req.user), ...(req.query.status ? { status: req.query.status } : {}) },
        include: ticketInclude,
        orderBy: { updatedAt: 'desc' },
        take: req.query.limit,
      });
      return rows.map(ticketDto);
    },
  );

  app.post(
    '/tickets',
    {
      schema: {
        tags,
        summary: 'Ask the district extension officer a question',
        security: bearer,
        body: TicketInput,
        response: { 201: TicketDetailDto, ...errors },
      },
    },
    async (req, reply) => {
      const u = req.user;
      if (u.role !== 'farmer') throw forbidden('Only farmers can ask questions');
      const farm = req.body.farmId ? await farmFor(u, req.body.farmId, true) : null;
      const districtId = farm?.districtId ?? u.districtId;
      if (!districtId) throw badRequest('no_district', 'Add your district or a farm first');
      const uploads = await ownUploads(u, req.body.uploadIds);
      const ticket = await prisma.ticket.create({
        data: {
          farmerId: u.sub,
          farmId: farm?.id,
          districtId,
          crop: req.body.crop ?? farm?.crop ?? null,
          category: req.body.category,
          subject: subjectOf(req.body.body),
          messages: {
            create: {
              authorId: u.sub,
              body: req.body.body,
              attachments: { create: uploads.map((x) => ({ uploadId: x.id })) },
            },
          },
        },
        include: { ...ticketInclude, messages: { include: messageInclude } },
      });
      const dto = ticketDto(ticket);
      app.rt.emit(rooms.officers(districtId), 'ticket:new', dto);
      const officers = await prisma.user.findMany({
        where: { role: 'officer', districtId, active: true },
        select: { id: true },
      });
      await notify(
        app,
        officers.map((o) => o.id),
        {
          type: 'ticket_new',
          refId: ticket.id,
          title: { en: `New question: ${dto.subject}`, hi: `नया प्रश्न: ${dto.subject}` },
        },
      );
      return reply.code(201).send({ ...dto, messages: ticket.messages.map(messageDto) });
    },
  );

  app.get(
    '/tickets/:id',
    {
      schema: {
        tags,
        summary: 'A question with its conversation',
        security: bearer,
        params: IdParams,
        response: { 200: TicketDetailDto, ...errors },
      },
    },
    async (req) => {
      await ticketFor(req.user, req.params.id);
      const t = await prisma.ticket.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { ...ticketInclude, messages: { include: messageInclude, orderBy: { createdAt: 'asc' } } },
      });
      return { ...ticketDto(t), messages: t.messages.map(messageDto) };
    },
  );

  app.post(
    '/tickets/:id/messages',
    {
      schema: {
        tags,
        summary: 'Reply to a question',
        description: 'An officer reply marks it answered. A farmer follow-up reopens it.',
        security: bearer,
        params: IdParams,
        body: MessageInput,
        response: { 201: TicketMessageDto, ...errors },
      },
    },
    async (req, reply) => {
      const u = req.user;
      const t = await ticketFor(u, req.params.id);
      const handler = canHandleTicket(u, t);
      if (!handler && t.farmerId !== u.sub) throw forbidden();
      const uploads = await ownUploads(u, req.body.uploadIds);
      const msg = await prisma.ticketMessage.create({
        data: {
          ticketId: t.id,
          authorId: u.sub,
          body: req.body.body,
          attachments: { create: uploads.map((x) => ({ uploadId: x.id })) },
        },
        include: messageInclude,
      });
      await prisma.ticket.update({
        where: { id: t.id },
        data: handler
          ? { status: 'answered', officerId: t.officerId ?? (u.role === 'officer' ? u.sub : null) }
          : { status: 'open' },
      });
      const dto = messageDto(msg);
      app.rt.emit(audience(t), 'ticket:message', dto);
      app.rt.emit(audience(t), 'ticket:updated', await loadDto(t.id));
      if (handler) {
        await notify(app, [t.farmerId], {
          type: 'ticket_reply',
          refId: t.id,
          title: { en: 'An officer replied to your question', hi: 'अधिकारी ने आपके प्रश्न का उत्तर दिया' },
        });
      } else {
        const to = t.officerId
          ? [t.officerId]
          : (
              await prisma.user.findMany({
                where: { role: 'officer', districtId: t.districtId },
                select: { id: true },
              })
            ).map((o) => o.id);
        await notify(app, to, {
          type: 'ticket_reply',
          refId: t.id,
          title: { en: `Farmer replied: ${t.subject}`, hi: `किसान ने उत्तर दिया: ${t.subject}` },
        });
      }
      return reply.code(201).send(dto);
    },
  );

  app.patch(
    '/tickets/:id',
    {
      schema: {
        tags,
        summary: 'Change a question’s status',
        description: 'Officers can set any status. Farmers can close their own question.',
        security: bearer,
        params: IdParams,
        body: z.object({ status: TicketStatusEnum }),
        response: { 200: TicketDto, ...errors },
      },
    },
    async (req) => {
      const u = req.user;
      const t = await ticketFor(u, req.params.id);
      const handler = canHandleTicket(u, t);
      if (!handler && !(t.farmerId === u.sub && req.body.status === 'closed')) {
        throw forbidden('You can only close your own question');
      }
      await prisma.ticket.update({ where: { id: t.id }, data: { status: req.body.status } });
      const dto = await loadDto(t.id);
      app.rt.emit(audience(t), 'ticket:updated', dto);
      if (handler && req.body.status !== t.status) {
        await notify(app, [t.farmerId], {
          type: 'ticket_status',
          refId: t.id,
          title:
            req.body.status === 'closed'
              ? { en: 'Your question was closed', hi: 'आपका प्रश्न बंद किया गया' }
              : { en: 'Your question was updated', hi: 'आपका प्रश्न अपडेट किया गया' },
        });
      }
      return dto;
    },
  );
};

export default ticketRoutes;
