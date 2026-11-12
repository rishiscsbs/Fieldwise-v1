import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AlertDto, AlertInput, NotificationListDto } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { alertDto, notificationDto } from '../lib/dto.js';
import { badRequest, forbidden } from '../lib/http.js';
import { toJson } from '../lib/json.js';
import { bearer, errors } from '../lib/route.js';
import { notify } from '../services/notify.js';
import { getReference } from '../services/reference.js';
import { rooms } from '../services/realtime.js';

const authorInclude = { author: { select: { id: true, name: true } } } as const;

const alertRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/alerts',
    {
      schema: {
        tags: ['alerts'],
        summary: 'Recent alerts for your district (and nationwide ones)',
        description:
          'Farmers only see crop-specific alerts for crops on their farms. Admins can pass districtId.',
        security: bearer,
        querystring: z.object({ districtId: z.string().optional() }),
        response: { 200: z.array(AlertDto), ...errors },
      },
    },
    async (req) => {
      const u = req.user;
      const district = u.role === 'admin' ? req.query.districtId : u.districtId;
      const where: Prisma.AlertWhereInput = district
        ? { OR: [{ districtId: district }, { districtId: null }] }
        : {};
      if (u.role === 'farmer') {
        const crops = (await prisma.farm.findMany({ where: { ownerId: u.sub }, select: { crop: true } }))
          .map((f) => f.crop)
          .filter((c): c is string => !!c);
        where.AND = [{ OR: [{ cropId: null }, { cropId: { in: crops } }] }];
      }
      const rows = await prisma.alert.findMany({
        where,
        include: authorInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return rows.map(alertDto);
    },
  );

  app.post(
    '/alerts',
    {
      preHandler: app.requireRole('officer', 'admin'),
      schema: {
        tags: ['alerts'],
        summary: 'Send an alert to farmers in a district, optionally only those growing one crop',
        description:
          'Officers send to their own district. Admins may send to every district (districtId null).',
        security: bearer,
        body: AlertInput,
        response: { 201: AlertDto, ...errors },
      },
    },
    async (req, reply) => {
      const u = req.user;
      const districtId = u.role === 'officer' ? u.districtId : (req.body.districtId ?? null);
      if (u.role === 'officer' && req.body.districtId && req.body.districtId !== u.districtId) {
        throw forbidden('Officers can only alert their own district');
      }
      if (u.role === 'officer' && !districtId)
        throw badRequest('no_district', 'Your account has no district');
      const ref = await getReference();
      if (req.body.cropId && !ref.crops.some((c) => c.id === req.body.cropId)) {
        throw badRequest('unknown_crop', 'Pick a crop from the list');
      }
      const alert = await prisma.alert.create({
        data: {
          authorId: u.sub,
          districtId,
          cropId: req.body.cropId ?? null,
          level: req.body.level,
          labels: toJson(req.body.labels),
        },
        include: authorInclude,
      });
      const dto = alertDto(alert);

      // Farmers with a farm in the district (growing the crop, if set), plus farmers registered there without farms.
      const farmFilter: Prisma.FarmWhereInput = {
        ...(districtId ? { districtId } : {}),
        ...(dto.cropId ? { crop: dto.cropId } : {}),
      };
      const owners = await prisma.farm.findMany({
        where: farmFilter,
        select: { ownerId: true },
        distinct: ['ownerId'],
      });
      const farmless = dto.cropId
        ? []
        : await prisma.user.findMany({
            where: {
              role: 'farmer',
              active: true,
              farms: { none: {} },
              ...(districtId ? { districtId } : {}),
            },
            select: { id: true },
          });
      const recipients = [...owners.map((o) => o.ownerId), ...farmless.map((f) => f.id)];
      app.rt.emit(recipients.map(rooms.user), 'alert:new', dto);
      if (districtId) app.rt.emit(rooms.officers(districtId), 'alert:new', dto);
      const short = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}…` : s);
      await notify(app, recipients, {
        type: 'alert',
        refId: alert.id,
        title: Object.fromEntries(
          Object.entries(dto.labels).map(([k, v]) => [k, short(v ?? '')]),
        ) as typeof dto.labels,
      });
      return reply.code(201).send(dto);
    },
  );

  app.get(
    '/notifications',
    {
      schema: {
        tags: ['alerts'],
        summary: 'Your notification centre: the 50 most recent, with the unread count',
        security: bearer,
        response: { 200: NotificationListDto, ...errors },
      },
    },
    async (req) => {
      const [items, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: req.user.sub },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.notification.count({ where: { userId: req.user.sub, readAt: null } }),
      ]);
      return { unread, items: items.map(notificationDto) };
    },
  );

  app.post(
    '/notifications/read',
    {
      schema: {
        tags: ['alerts'],
        summary: 'Mark notifications read (all of them when ids is omitted)',
        security: bearer,
        body: z.object({ ids: z.array(z.string()).max(200).optional() }),
        response: { 200: z.object({ unread: z.number() }), ...errors },
      },
    },
    async (req) => {
      await prisma.notification.updateMany({
        where: { userId: req.user.sub, readAt: null, ...(req.body.ids ? { id: { in: req.body.ids } } : {}) },
        data: { readAt: new Date() },
      });
      return { unread: await prisma.notification.count({ where: { userId: req.user.sub, readAt: null } }) };
    },
  );
};

export default alertRoutes;
