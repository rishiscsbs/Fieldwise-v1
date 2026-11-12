import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { OfficerMapDto, OfficerSummaryDto, PestPointsDto, TicketCategoryEnum } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { badRequest, forbidden } from '../lib/http.js';
import { parseLabels } from '../lib/json.js';
import { bearer, errors } from '../lib/route.js';
import type { AccessClaims } from '../plugins/auth.js';

const tags = ['officer'];
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const Query = z.object({
  /** Admins pick a district; officers always get their own */
  districtId: z.string().optional(),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

/** Officers see their own district; admins any district they ask for (default: the first one). */
async function districtFor(u: AccessClaims, requested?: string): Promise<string> {
  if (u.role === 'officer') {
    if (!u.districtId) throw badRequest('no_district', 'Your account has no district');
    if (requested && requested !== u.districtId) throw forbidden('Officers can only see their own district');
    return u.districtId;
  }
  if (requested) {
    if (!(await prisma.district.findUnique({ where: { id: requested } }))) {
      throw badRequest('unknown_district', 'Pick a district from the list');
    }
    return requested;
  }
  return (await prisma.district.findFirstOrThrow({ where: { active: true }, orderBy: { id: 'asc' } })).id;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Monday 00:00 (UTC) of the week containing d, as YYYY-MM-DD. */
const weekStart = (d: Date) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
};

const officerRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.requireRole('officer', 'admin'));

  app.get(
    '/officer/summary',
    {
      schema: {
        tags,
        summary: 'District at a glance: farmers, question queue, response time, pests and issue mix',
        security: bearer,
        querystring: Query,
        response: { 200: OfficerSummaryDto, ...errors },
      },
    },
    async (req) => {
      const districtId = await districtFor(req.user, req.query.districtId);
      const { days } = req.query;
      const now = Date.now();
      const since = new Date(now - days * DAY);
      const [farms, statusCounts, windowTickets, openTickets, pests, alertsSent] = await Promise.all([
        prisma.farm.findMany({
          where: { districtId },
          select: { ownerId: true, areaAcres: true, crop: true },
        }),
        prisma.ticket.groupBy({ by: ['status'], where: { districtId }, _count: true }),
        prisma.ticket.findMany({
          where: { districtId, createdAt: { gte: since } },
          select: {
            category: true,
            createdAt: true,
            farmerId: true,
            messages: {
              select: { createdAt: true, author: { select: { role: true } } },
              orderBy: { createdAt: 'asc' },
            },
          },
        }),
        prisma.ticket.findMany({
          where: { districtId, status: 'open' },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        }),
        prisma.pestReport.groupBy({
          by: ['pestId'],
          where: { districtId, reportedAt: { gte: since } },
          _count: true,
        }),
        prisma.alert.count({ where: { districtId, createdAt: { gte: since } } }),
      ]);

      const tickets = { open: 0, answered: 0, closed: 0 };
      for (const s of statusCounts)
        if (s.status in tickets) tickets[s.status as keyof typeof tickets] = s._count;

      // Response time = first message to first reply by an officer or admin.
      const responses: number[] = [];
      const weekly = new Map<string, { opened: number; answered: number }>();
      for (let w = 7; w >= 0; w--)
        weekly.set(weekStart(new Date(now - w * 7 * DAY)), { opened: 0, answered: 0 });
      const categories = new Map<string, number>(TicketCategoryEnum.options.map((c) => [c, 0]));
      for (const t of windowTickets) {
        categories.set(t.category, (categories.get(t.category) ?? 0) + 1);
        const wk = weekly.get(weekStart(t.createdAt));
        if (wk) wk.opened++;
        const reply = t.messages.find((m) => m.author.role !== 'farmer');
        if (reply) {
          responses.push((reply.createdAt.getTime() - t.createdAt.getTime()) / HOUR);
          const rw = weekly.get(weekStart(reply.createdAt));
          if (rw) rw.answered++;
        }
      }

      const crops = new Map<string, number>();
      for (const f of farms) if (f.crop) crops.set(f.crop, (crops.get(f.crop) ?? 0) + 1);

      return {
        districtId,
        days,
        farmers: new Set(farms.map((f) => f.ownerId)).size,
        farms: farms.length,
        areaAcres: farms.reduce((s, f) => s + f.areaAcres, 0),
        tickets,
        medianResponseHours: median(responses),
        oldestOpenHours: openTickets[0] ? (now - openTickets[0].createdAt.getTime()) / HOUR : null,
        pestReports: pests.reduce((s, p) => s + p._count, 0),
        alertsSent,
        categories: [...categories]
          .map(([category, count]) => ({ category: TicketCategoryEnum.parse(category), count }))
          .sort((a, b) => b.count - a.count),
        weekly: [...weekly].map(([weekStart, v]) => ({ weekStart, ...v })),
        topPests: pests
          .map((p) => ({ pestId: p.pestId, count: p._count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
        crops: [...crops].map(([cropId, n]) => ({ cropId, farms: n })).sort((a, b) => b.farms - a.farms),
      };
    },
  );

  app.get(
    '/officer/map',
    {
      schema: {
        tags,
        summary: 'Farms and open questions in the district, with coordinates',
        description: 'Farms without coordinates are placed at the district centre.',
        security: bearer,
        querystring: Query.pick({ districtId: true }),
        response: { 200: OfficerMapDto, ...errors },
      },
    },
    async (req) => {
      const districtId = await districtFor(req.user, req.query.districtId);
      const [d, farms, open] = await Promise.all([
        prisma.district.findUniqueOrThrow({ where: { id: districtId } }),
        prisma.farm.findMany({
          where: { districtId },
          include: {
            owner: { select: { name: true } },
            _count: { select: { tickets: { where: { status: 'open' } } } },
          },
        }),
        prisma.ticket.findMany({
          where: { districtId, status: 'open' },
          include: { farm: { select: { lat: true, lon: true } }, farmer: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      return {
        district: { id: d.id, labels: parseLabels(d.labels), lat: d.lat, lon: d.lon },
        farms: farms.map((f) => ({
          id: f.id,
          name: f.name,
          farmer: f.owner.name,
          lat: f.lat ?? d.lat,
          lon: f.lon ?? d.lon,
          crop: f.crop,
          areaAcres: f.areaAcres,
          openTickets: f._count.tickets,
        })),
        tickets: open.map((t) => ({
          id: t.id,
          subject: t.subject,
          category: TicketCategoryEnum.catch('other').parse(t.category),
          farmer: t.farmer.name,
          lat: t.farm?.lat ?? d.lat,
          lon: t.farm?.lon ?? d.lon,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    '/officer/pests',
    {
      schema: {
        tags,
        summary: 'Pest sightings in the district for the heatmap',
        security: bearer,
        querystring: Query.extend({ pestId: z.string().optional() }),
        response: { 200: PestPointsDto, ...errors },
      },
    },
    async (req) => {
      const districtId = await districtFor(req.user, req.query.districtId);
      const reports = await prisma.pestReport.findMany({
        where: {
          districtId,
          reportedAt: { gte: new Date(Date.now() - req.query.days * DAY) },
          ...(req.query.pestId ? { pestId: req.query.pestId } : {}),
        },
        orderBy: { reportedAt: 'desc' },
        take: 2000,
      });
      return {
        districtId,
        days: req.query.days,
        reports: reports.map((r) => ({
          pestId: r.pestId,
          lat: r.lat,
          lon: r.lon,
          reportedAt: r.reportedAt.toISOString(),
          source: r.source,
        })),
      };
    },
  );
};

export default officerRoutes;
