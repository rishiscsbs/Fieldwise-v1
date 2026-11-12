import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  FarmDetailDto,
  FarmDto,
  FarmInput,
  SoilTestDto,
  SoilTestInput,
  type ReferenceData,
} from '@fieldwise/shared';
import { prisma } from '../db.js';
import { farmFor } from '../lib/access.js';
import { farmDto, soilTestDto } from '../lib/dto.js';
import { badRequest } from '../lib/http.js';
import { IdParams, bearer, errors } from '../lib/route.js';
import { getReference } from '../services/reference.js';

const tags = ['farms'];

/** Rejects ids that are not in the reference data. */
function checkRefs(ref: ReferenceData, f: Partial<z.infer<typeof FarmInput>>) {
  if (f.districtId !== undefined && !ref.districts[f.districtId])
    throw badRequest('unknown_district', 'Pick a district from the list');
  if (f.soil !== undefined && !ref.soils[f.soil])
    throw badRequest('unknown_soil', 'Pick a soil type from the list');
  if (f.crop && !ref.crops.some((c) => c.id === f.crop))
    throw badRequest('unknown_crop', 'Pick a crop from the list');
}

const latestInclude = { soilTests: { orderBy: { testedAt: 'desc' as const }, take: 1 } };

const farmRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/farms',
    {
      schema: {
        tags,
        summary: 'Farms you can see',
        description:
          'Farmers get their own farms. Officers get farms in their district; admins can pass districtId.',
        security: bearer,
        querystring: z.object({ districtId: z.string().optional() }),
        response: { 200: z.array(FarmDto), ...errors },
      },
    },
    async (req) => {
      const u = req.user;
      const where =
        u.role === 'farmer'
          ? { ownerId: u.sub }
          : u.role === 'officer'
            ? { districtId: u.districtId ?? '__none__' }
            : req.query.districtId
              ? { districtId: req.query.districtId }
              : {};
      const farms = await prisma.farm.findMany({
        where,
        include: latestInclude,
        orderBy: { createdAt: 'asc' },
      });
      return farms.map((f) => farmDto(f, f.soilTests[0]));
    },
  );

  app.post(
    '/farms',
    {
      schema: {
        tags,
        summary: 'Add a farm, optionally with its first Soil Health Card',
        security: bearer,
        body: FarmInput.extend({ soilTest: SoilTestInput.optional() }),
        response: { 201: FarmDetailDto, ...errors },
      },
    },
    async (req, reply) => {
      const { soilTest, ...data } = req.body;
      checkRefs(await getReference(), data);
      const farm = await prisma.farm.create({
        data: { ...data, ownerId: req.user.sub, ...(soilTest ? { soilTests: { create: soilTest } } : {}) },
        include: { soilTests: { orderBy: { testedAt: 'desc' } } },
      });
      return reply
        .code(201)
        .send({ ...farmDto(farm, farm.soilTests[0]), soilTests: farm.soilTests.map(soilTestDto) });
    },
  );

  app.get(
    '/farms/:id',
    {
      schema: {
        tags,
        summary: 'One farm with its Soil Health Card history (newest first)',
        security: bearer,
        params: IdParams,
        response: { 200: FarmDetailDto, ...errors },
      },
    },
    async (req) => {
      const farm = await farmFor(req.user, req.params.id);
      const tests = await prisma.soilTest.findMany({
        where: { farmId: farm.id },
        orderBy: { testedAt: 'desc' },
      });
      return { ...farmDto(farm, tests[0]), soilTests: tests.map(soilTestDto) };
    },
  );

  app.patch(
    '/farms/:id',
    {
      schema: {
        tags,
        summary: 'Change farm details or the chosen crop',
        security: bearer,
        params: IdParams,
        body: FarmInput.partial(),
        response: { 200: FarmDto, ...errors },
      },
    },
    async (req) => {
      await farmFor(req.user, req.params.id, true);
      checkRefs(await getReference(), req.body);
      const farm = await prisma.farm.update({
        where: { id: req.params.id },
        data: req.body,
        include: latestInclude,
      });
      return farmDto(farm, farm.soilTests[0]);
    },
  );

  app.delete(
    '/farms/:id',
    {
      schema: {
        tags,
        summary: 'Delete a farm',
        security: bearer,
        params: IdParams,
        response: { 204: z.null(), ...errors },
      },
    },
    async (req, reply) => {
      await farmFor(req.user, req.params.id, true);
      await prisma.farm.delete({ where: { id: req.params.id } });
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/farms/:id/soil-tests',
    {
      schema: {
        tags,
        summary: 'Soil Health Card history, oldest first (for charts)',
        security: bearer,
        params: IdParams,
        response: { 200: z.array(SoilTestDto), ...errors },
      },
    },
    async (req) => {
      const farm = await farmFor(req.user, req.params.id);
      const tests = await prisma.soilTest.findMany({
        where: { farmId: farm.id },
        orderBy: { testedAt: 'asc' },
      });
      return tests.map(soilTestDto);
    },
  );

  app.post(
    '/farms/:id/soil-tests',
    {
      schema: {
        tags,
        summary: 'Add a Soil Health Card reading',
        security: bearer,
        params: IdParams,
        body: SoilTestInput.extend({ source: z.enum(['shc', 'self']).default('shc') }),
        response: { 201: SoilTestDto, ...errors },
      },
    },
    async (req, reply) => {
      const farm = await farmFor(req.user, req.params.id, true);
      if (req.body.testedAt.getTime() > Date.now() + 86_400_000)
        throw badRequest('future_date', 'The test date cannot be in the future');
      const t = await prisma.soilTest.create({ data: { ...req.body, farmId: farm.id } });
      return reply.code(201).send(soilTestDto(t));
    },
  );
};

export default farmRoutes;
