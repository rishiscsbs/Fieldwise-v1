import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HealthCheckDto, UploadDto, matchPests, type HealthCheckDto as HealthCheck } from '@fieldwise/shared';
import type { HealthCheck as HealthRow, Upload } from '@prisma/client';
import { prisma } from '../db.js';
import { farmFor } from '../lib/access.js';
import { badRequest, notFound } from '../lib/http.js';
import { parseList, toJson } from '../lib/json.js';
import { bearer, errors } from '../lib/route.js';
import { getAnalyser } from '../services/analysers/index.js';
import { getReference } from '../services/reference.js';
import { decodeImage, readUpload, saveUpload, uploadDto, verifySignature } from '../services/uploads.js';

const tags = ['uploads'];
const multipart = { consumes: ['multipart/form-data'] };

/** Reads the single `file` part of a multipart request. */
async function fileBuffer(req: FastifyRequest): Promise<Buffer> {
  if (!req.isMultipart()) throw badRequest('upload_missing', 'Attach a photo');
  const part = await req.file();
  if (!part) throw badRequest('upload_missing', 'Attach a photo');
  const buf = await part.toBuffer();
  if (part.file.truncated) throw badRequest('upload_too_large', 'Photos must be 5 MB or smaller');
  return buf;
}

const healthDto = (h: HealthRow & { upload: Upload | null }): HealthCheck => {
  const r = JSON.parse(h.result) as Omit<HealthCheck, 'id' | 'crop' | 'upload' | 'createdAt' | 'symptoms'>;
  return {
    id: h.id,
    crop: h.crop,
    analyser: r.analyser,
    colours: r.colours,
    findings: r.findings,
    regions: r.regions,
    matches: r.matches,
    symptoms: parseList(h.symptoms),
    upload: uploadDto(h.upload!),
    createdAt: h.createdAt.toISOString(),
  };
};

const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/uploads',
    {
      preHandler: app.authenticate,
      schema: {
        tags,
        summary: 'Upload a photo (JPEG or PNG, up to 5 MB) in the `file` field',
        description: 'Returns a signed URL valid for at least an hour. Attach the id to a question.',
        security: bearer,
        ...multipart,
        response: { 201: UploadDto, ...errors },
      },
    },
    async (req, reply) => {
      const upload = await saveUpload(req.user.sub, await fileBuffer(req));
      return reply.code(201).send(uploadDto(upload));
    },
  );

  app.get(
    '/uploads/:id',
    {
      schema: {
        tags,
        summary: 'Fetch an uploaded photo by signed URL',
        params: z.object({ id: z.string() }),
        querystring: z.object({ exp: z.coerce.number(), sig: z.string() }),
      },
    },
    async (req, reply) => {
      if (!verifySignature(req.params.id, req.query.exp, req.query.sig)) {
        return reply.code(403).send({ error: 'link_expired', message: 'This link has expired' });
      }
      const u = await prisma.upload.findUnique({ where: { id: req.params.id } });
      if (!u) throw notFound('Photo');
      return reply
        .header('content-type', u.mime)
        .header('cache-control', 'private, max-age=3600, immutable')
        .header('x-content-type-options', 'nosniff')
        .send(await readUpload(u));
    },
  );

  app.post(
    '/health/analyse',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['advisory'],
        summary: 'Check a leaf photo (multipart `file`) and suggest symptoms',
        description:
          'Uses the configured analyser. The default is a colour screen, not a trained disease model (analyser.isModel is false).',
        security: bearer,
        ...multipart,
        querystring: z.object({ crop: z.string(), farmId: z.string().optional() }),
        response: { 201: HealthCheckDto, ...errors },
      },
    },
    async (req, reply) => {
      const ref = await getReference();
      if (!ref.crops.some((c) => c.id === req.query.crop))
        throw badRequest('unknown_crop', 'Pick a crop from the list');
      const farm = req.query.farmId ? await farmFor(req.user, req.query.farmId, true) : null;
      const buf = await fileBuffer(req);
      const upload = await saveUpload(req.user.sub, buf);
      let img;
      try {
        img = decodeImage(buf);
      } catch {
        throw badRequest('image_unreadable', 'This photo could not be read. Try another one');
      }
      const analyser = getAnalyser();
      const a = await analyser.analyse(img, req.query.crop);
      const matches = a.symptoms.length
        ? matchPests(req.query.crop, a.symptoms, ref.pests).map((m) => ({
            pestId: m.pest.id,
            score: m.score,
          }))
        : [];
      const row = await prisma.healthCheck.create({
        data: {
          userId: req.user.sub,
          farmId: farm?.id,
          uploadId: upload.id,
          crop: req.query.crop,
          analyser: analyser.id,
          symptoms: toJson(a.symptoms),
          result: toJson({
            analyser: { id: analyser.id, version: analyser.version, isModel: analyser.isModel },
            colours: a.colours,
            findings: a.findings,
            regions: a.regions,
            matches,
          }),
        },
        include: { upload: true },
      });
      return reply.code(201).send(healthDto(row));
    },
  );

  app.get(
    '/health/checks',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['advisory'],
        summary: 'Your recent leaf photo checks',
        security: bearer,
        querystring: z.object({ farmId: z.string().optional() }),
        response: { 200: z.array(HealthCheckDto), ...errors },
      },
    },
    async (req) => {
      const rows = await prisma.healthCheck.findMany({
        where: {
          userId: req.user.sub,
          ...(req.query.farmId ? { farmId: req.query.farmId } : {}),
          uploadId: { not: null },
        },
        include: { upload: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return rows.map(healthDto);
    },
  );
};

export default uploadRoutes;
