import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { PublicMetricsDto } from '@fieldwise/shared';
import { prisma } from '../db.js';

const CACHE_MS = 60_000;
let cached: { at: number; body: PublicMetricsDto } | null = null;

/** Aggregate counts only; nothing here identifies a person. */
async function metrics(): Promise<PublicMetricsDto> {
  const [districts, crops, pests, farmers, farmAgg, alertsSent, pestReports, answered] = await Promise.all([
    prisma.district.count({ where: { active: true } }),
    prisma.crop.count({ where: { active: true } }),
    prisma.pest.count(),
    prisma.user.count({ where: { role: 'farmer', active: true } }),
    prisma.farm.aggregate({ _count: true, _sum: { areaAcres: true } }),
    prisma.alert.count(),
    prisma.pestReport.count(),
    prisma.ticket.findMany({
      where: { status: { in: ['answered', 'closed'] } },
      select: {
        createdAt: true,
        messages: {
          select: { createdAt: true, author: { select: { role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);
  const hours = answered
    .map((t) => t.messages.find((m) => m.author.role !== 'farmer'))
    .flatMap((reply, i) =>
      reply ? [(reply.createdAt.getTime() - answered[i]!.createdAt.getTime()) / 3_600_000] : [],
    )
    .sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return {
    districts,
    crops,
    pests,
    farmers,
    farms: farmAgg._count,
    areaAcres: Math.round(farmAgg._sum.areaAcres ?? 0),
    questionsAnswered: answered.length,
    medianResponseHours: hours.length
      ? hours.length % 2
        ? hours[mid]!
        : (hours[mid - 1]! + hours[mid]!) / 2
      : null,
    alertsSent,
    pestReports,
    generatedAt: new Date().toISOString(),
  };
}

const publicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/public/metrics',
    {
      schema: {
        tags: ['public'],
        summary: 'Headline counts for the landing page and pitch deck',
        description: 'Public and cached for a minute. Aggregates only; no personal data.',
        response: { 200: PublicMetricsDto },
      },
    },
    async (_req, reply) => {
      if (!cached || Date.now() - cached.at > CACHE_MS) cached = { at: Date.now(), body: await metrics() };
      reply.header('cache-control', 'public, max-age=60');
      return cached.body;
    },
  );
};

export default publicRoutes;
