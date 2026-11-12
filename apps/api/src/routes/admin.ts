import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Crop as CropRow, District, Market, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  AdminCropCreate,
  AdminCropDto,
  AdminCropPatch,
  AdminDistrictDto,
  AdminDistrictPatch,
  AdminOverviewDto,
  AdminUserCreate,
  AdminUserDto,
  AdminUserPatch,
  Role,
} from '@fieldwise/shared';
import { prisma } from '../db.js';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http.js';
import { parseLabels, parseList, toJson } from '../lib/json.js';
import { IdParams, bearer, errors } from '../lib/route.js';
import { invalidateReference } from '../services/reference.js';

const tags = ['admin'];
const DAY = 86_400_000;

const districtDto = (d: District & { markets: Market[] }) => ({
  id: d.id,
  labels: parseLabels(d.labels),
  lat: d.lat,
  lon: d.lon,
  rainMm: d.rainMm,
  temp: { kharif: d.tempKharif, rabi: d.tempRabi, zaid: d.tempZaid },
  soil: d.soil,
  ph: d.ph,
  active: d.active,
  markets: [...d.markets].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.name),
});

const cropDto = (c: CropRow) => ({
  id: c.id,
  e: c.emoji,
  n: parseLabels(c.labels),
  s: parseList(c.seasons),
  soil: parseList(c.soils),
  ph: [c.phMin, c.phMax],
  w: [c.waterMin, c.waterMax],
  t: [c.tempMin, c.tempMax],
  npk: [c.nKgHa, c.pKgHa, c.kKgHa],
  kc: c.kc,
  d: c.duration,
  y: c.yield,
  msp: c.msp,
  p: c.price,
  leg: c.legume ? 1 : 0,
  active: c.active,
});

/** Engine-shaped crop fields → database columns. */
function cropData(p: z.infer<typeof AdminCropPatch>): Prisma.CropUpdateInput {
  return {
    ...(p.e !== undefined && { emoji: p.e }),
    ...(p.n && { labels: toJson(p.n) }),
    ...(p.s && { seasons: toJson(p.s) }),
    ...(p.soil && { soils: toJson(p.soil) }),
    ...(p.ph && { phMin: p.ph[0], phMax: p.ph[1] }),
    ...(p.w && { waterMin: p.w[0], waterMax: p.w[1] }),
    ...(p.t && { tempMin: p.t[0], tempMax: p.t[1] }),
    ...(p.npk && { nKgHa: p.npk[0], pKgHa: p.npk[1], kKgHa: p.npk[2] }),
    ...(p.kc !== undefined && { kc: p.kc }),
    ...(p.d !== undefined && { duration: p.d }),
    ...(p.y !== undefined && { yield: p.y }),
    ...(p.msp !== undefined && { msp: p.msp }),
    ...(p.p !== undefined && { price: p.p }),
    ...(p.leg !== undefined && { legume: !!p.leg }),
    ...(p.active !== undefined && { active: p.active }),
  };
}

function checkRanges(p: z.infer<typeof AdminCropPatch>) {
  for (const k of ['ph', 'w', 't'] as const) {
    const r = p[k];
    if (r && r[0] > r[1])
      throw badRequest('bad_range', `The lowest value must not be above the highest (${k})`);
  }
}

const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('admin'));

  app.get(
    '/admin/overview',
    {
      schema: {
        tags,
        summary: 'Users by role and activity per district',
        security: bearer,
        response: { 200: AdminOverviewDto, ...errors },
      },
    },
    async () => {
      const since = new Date(Date.now() - 30 * DAY);
      const [roles, districts, farms, owners, open, pests, officers] = await Promise.all([
        prisma.user.groupBy({ by: ['role'], where: { active: true }, _count: true }),
        prisma.district.findMany({ orderBy: { id: 'asc' } }),
        prisma.farm.groupBy({ by: ['districtId'], _count: true }),
        prisma.farm.findMany({
          select: { districtId: true, ownerId: true },
          distinct: ['districtId', 'ownerId'],
        }),
        prisma.ticket.groupBy({ by: ['districtId'], where: { status: 'open' }, _count: true }),
        prisma.pestReport.groupBy({
          by: ['districtId'],
          where: { reportedAt: { gte: since } },
          _count: true,
        }),
        prisma.user.groupBy({ by: ['districtId'], where: { role: 'officer', active: true }, _count: true }),
      ]);
      const count = <T extends { _count: number }>(rows: T[], key: (r: T) => string | null, id: string) =>
        rows.find((r) => key(r) === id)?._count ?? 0;
      const users = { farmer: 0, officer: 0, admin: 0 };
      for (const r of roles) users[Role.parse(r.role)] = r._count;
      return {
        users,
        districts: districts.map((d) => ({
          id: d.id,
          labels: parseLabels(d.labels),
          lat: d.lat,
          lon: d.lon,
          active: d.active,
          farmers: owners.filter((o) => o.districtId === d.id).length,
          farms: count(farms, (r) => r.districtId, d.id),
          openTickets: count(open, (r) => r.districtId, d.id),
          pestReports: count(pests, (r) => r.districtId, d.id),
          officers: count(officers, (r) => r.districtId, d.id),
        })),
      };
    },
  );

  // ---------- users ----------

  app.get(
    '/admin/users',
    {
      schema: {
        tags,
        summary: 'Search users',
        security: bearer,
        querystring: z.object({
          role: Role.optional(),
          districtId: z.string().optional(),
          q: z.string().trim().max(60).optional(),
        }),
        response: { 200: z.array(AdminUserDto), ...errors },
      },
    },
    async (req) => {
      const { role, districtId, q } = req.query;
      const rows = await prisma.user.findMany({
        where: {
          ...(role && { role }),
          ...(districtId && { districtId }),
          ...(q && { OR: [{ name: { contains: q } }, { phone: { contains: q.replace(/\s/g, '') } }] }),
        },
        include: { _count: { select: { farms: true } } },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        take: 200,
      });
      return rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        name: u.name,
        role: Role.parse(u.role),
        districtId: u.districtId,
        lang: u.lang,
        active: u.active,
        farms: u._count.farms,
        createdAt: u.createdAt.toISOString(),
      }));
    },
  );

  app.post(
    '/admin/users',
    {
      schema: {
        tags,
        summary: 'Add a user, e.g. an extension officer for a district',
        security: bearer,
        body: AdminUserCreate,
        response: { 201: AdminUserDto, 409: errors[400], ...errors },
      },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.role === 'officer' && !b.districtId)
        throw badRequest('district_required', 'Officers need a district');
      if (b.districtId && !(await prisma.district.findUnique({ where: { id: b.districtId } }))) {
        throw badRequest('unknown_district', 'Pick a district from the list');
      }
      if (await prisma.user.findUnique({ where: { phone: b.phone } })) {
        throw new HttpError(409, 'phone_taken', 'Someone already uses this number');
      }
      const u = await prisma.user.create({ data: b });
      return reply.code(201).send({ ...u, role: b.role, farms: 0, createdAt: u.createdAt.toISOString() });
    },
  );

  app.patch(
    '/admin/users/:id',
    {
      schema: {
        tags,
        summary: 'Change a user’s name, role, district or turn the account off',
        description:
          'Role, district or active changes sign the user out everywhere so their access updates at once.',
        security: bearer,
        params: IdParams,
        body: AdminUserPatch,
        response: { 200: AdminUserDto, ...errors },
      },
    },
    async (req) => {
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw notFound('User');
      const b = req.body;
      if (target.id === req.user.sub && (b.active === false || (b.role && b.role !== 'admin'))) {
        throw forbidden('You cannot turn off or demote your own account');
      }
      if (b.districtId && !(await prisma.district.findUnique({ where: { id: b.districtId } }))) {
        throw badRequest('unknown_district', 'Pick a district from the list');
      }
      if (
        (b.role ?? target.role) === 'officer' &&
        !(b.districtId !== undefined ? b.districtId : target.districtId)
      ) {
        throw badRequest('district_required', 'Officers need a district');
      }
      const u = await prisma.user.update({
        where: { id: target.id },
        data: b,
        include: { _count: { select: { farms: true } } },
      });
      const accessChanged =
        (b.role && b.role !== target.role) ||
        (b.districtId !== undefined && b.districtId !== target.districtId) ||
        b.active === false;
      if (accessChanged) {
        await prisma.refreshToken.updateMany({
          where: { userId: u.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return {
        id: u.id,
        phone: u.phone,
        name: u.name,
        role: Role.parse(u.role),
        districtId: u.districtId,
        lang: u.lang,
        active: u.active,
        farms: u._count.farms,
        createdAt: u.createdAt.toISOString(),
      };
    },
  );

  // ---------- districts ----------

  app.get(
    '/admin/districts',
    {
      schema: {
        tags,
        summary: 'All districts, including turned-off ones',
        security: bearer,
        response: { 200: z.array(AdminDistrictDto), ...errors },
      },
    },
    async () =>
      (await prisma.district.findMany({ include: { markets: true }, orderBy: { id: 'asc' } })).map(
        districtDto,
      ),
  );

  app.patch(
    '/admin/districts/:id',
    {
      schema: {
        tags,
        summary: 'Edit district climate, soil, names or nearby mandis',
        description: 'Changes reach the advisory engine within a minute.',
        security: bearer,
        params: IdParams,
        body: AdminDistrictPatch,
        response: { 200: AdminDistrictDto, ...errors },
      },
    },
    async (req) => {
      const b = req.body;
      if (!(await prisma.district.findUnique({ where: { id: req.params.id } }))) throw notFound('District');
      if (b.soil && !(await prisma.soil.findUnique({ where: { id: b.soil } })))
        throw badRequest('unknown_soil', 'Pick a soil type from the list');
      const d = await prisma.$transaction(async (tx) => {
        if (b.markets) {
          await tx.market.deleteMany({ where: { districtId: req.params.id } });
          await tx.market.createMany({
            data: b.markets.map((name, sortOrder) => ({ districtId: req.params.id, name, sortOrder })),
          });
        }
        return tx.district.update({
          where: { id: req.params.id },
          data: {
            ...(b.labels && { labels: toJson(b.labels) }),
            ...(b.rainMm !== undefined && { rainMm: b.rainMm }),
            ...(b.temp?.kharif !== undefined && { tempKharif: b.temp.kharif }),
            ...(b.temp?.rabi !== undefined && { tempRabi: b.temp.rabi }),
            ...(b.temp?.zaid !== undefined && { tempZaid: b.temp.zaid }),
            ...(b.soil && { soil: b.soil }),
            ...(b.ph !== undefined && { ph: b.ph }),
            ...(b.active !== undefined && { active: b.active }),
          },
          include: { markets: true },
        });
      });
      invalidateReference();
      return districtDto(d);
    },
  );

  // ---------- crops ----------

  app.get(
    '/admin/crops',
    {
      schema: {
        tags,
        summary: 'All crops, including turned-off ones',
        security: bearer,
        response: { 200: z.array(AdminCropDto), ...errors },
      },
    },
    async () => (await prisma.crop.findMany({ orderBy: { sortOrder: 'asc' } })).map(cropDto),
  );

  app.patch(
    '/admin/crops/:id',
    {
      schema: {
        tags,
        summary: 'Edit crop reference values (MSP, price, yield, needs) or turn a crop off',
        description: 'Changes reach the advisory engine within a minute.',
        security: bearer,
        params: IdParams,
        body: AdminCropPatch,
        response: { 200: AdminCropDto, ...errors },
      },
    },
    async (req) => {
      if (!(await prisma.crop.findUnique({ where: { id: req.params.id } }))) throw notFound('Crop');
      checkRanges(req.body);
      const c = await prisma.crop.update({ where: { id: req.params.id }, data: cropData(req.body) });
      invalidateReference();
      return cropDto(c);
    },
  );

  app.post(
    '/admin/crops',
    {
      schema: {
        tags,
        summary: 'Add a crop',
        security: bearer,
        body: AdminCropCreate,
        response: { 201: AdminCropDto, 409: errors[400], ...errors },
      },
    },
    async (req, reply) => {
      if (await prisma.crop.findUnique({ where: { id: req.body.id } })) {
        throw new HttpError(409, 'crop_exists', 'A crop with this id already exists');
      }
      checkRanges(req.body);
      const order = (await prisma.crop.count()) + 1;
      const c = await prisma.crop.create({
        data: {
          ...(cropData(req.body) as Prisma.CropCreateInput),
          id: req.body.id,
          sortOrder: order,
          msp: req.body.msp ?? null,
        },
      });
      invalidateReference();
      return reply.code(201).send(cropDto(c));
    },
  );
};

export default adminRoutes;
