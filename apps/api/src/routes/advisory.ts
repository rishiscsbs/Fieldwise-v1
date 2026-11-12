import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  DiagnoseInput,
  FertiliserDto,
  ForecastDto,
  MandiDto,
  PestMatchDto,
  RecommendationsDto,
  SeasonEnum,
  WaterDto,
  activeCrop,
  fertPlan,
  fertSchedule,
  fungalRisk,
  matchPests,
  recommend,
  seasonFor,
  waterPlan,
  type Crop,
  type ReferenceData,
} from '@fieldwise/shared';
import { prisma } from '../db.js';
import { farmFor } from '../lib/access.js';
import { badRequest } from '../lib/http.js';
import { IdParams, bearer, errors } from '../lib/route.js';
import { getMandi } from '../services/mandi/index.js';
import { farmProfile, latestSoilTest } from '../services/profile.js';
import { getReference } from '../services/reference.js';
import { getForecast } from '../services/weather.js';

const tags = ['advisory'];
const CropQuery = z.object({ crop: z.string().optional() });

/** Confident symptom matches become pest reports for the officer heatmap. */
const REPORT_MIN_SCORE = 60;

function cropById(ref: ReferenceData, id: string): Crop {
  const c = ref.crops.find((x) => x.id === id);
  if (!c) throw badRequest('unknown_crop', 'Pick a crop from the list');
  return c;
}

const advisoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Farm, engine profile and the crop to plan for (query ?crop= overrides the farm's choice). */
  async function context(user: Parameters<typeof farmFor>[0], farmId: string, crop?: string) {
    const [farm, ref] = await Promise.all([farmFor(user, farmId), getReference()]);
    const { profile, usingDefaults } = farmProfile(farm, await latestSoilTest(farm.id), ref);
    const c = crop ? cropById(ref, crop) : activeCrop(profile, farm.crop, ref);
    return { farm, ref, profile, usingDefaults, crop: c };
  }

  app.get(
    '/farms/:id/recommendations',
    {
      schema: {
        tags,
        summary: 'Crops for this season scored out of 100, with reasons',
        description: 'Reasons are translation keys in the advice namespace with arguments.',
        security: bearer,
        params: IdParams,
        response: { 200: RecommendationsDto, ...errors },
      },
    },
    async (req) => {
      const { farm, ref, profile, usingDefaults, crop } = await context(req.user, req.params.id);
      const r = recommend(profile, ref);
      return {
        farmId: farm.id,
        season: profile.season,
        water: r.water,
        temp: r.temp,
        usingDefaults,
        activeCrop: crop.id,
        list: r.list.map((x) => ({ cropId: x.crop.id, score: x.score, reasons: x.reasons })),
        out: r.out.map((c) => c.id),
      };
    },
  );

  app.get(
    '/farms/:id/fertiliser',
    {
      schema: {
        tags,
        summary: 'Urea, DAP and MOP for the field, adjusted to the Soil Health Card, with a schedule',
        security: bearer,
        params: IdParams,
        querystring: CropQuery,
        response: { 200: FertiliserDto, ...errors },
      },
    },
    async (req) => {
      const { farm, ref, profile, usingDefaults, crop } = await context(
        req.user,
        req.params.id,
        req.query.crop,
      );
      const plan = fertPlan(crop, profile, ref);
      return {
        farmId: farm.id,
        cropId: crop.id,
        areaAcres: profile.area,
        usingDefaults,
        levels: plan.lv,
        recommendedPerHa: crop.npk,
        adjustedPerHa: plan.ha,
        perField: plan.perField,
        kg: plan.kg,
        bags: plan.bags,
        cost: plan.cost,
        schedule: fertSchedule(crop, plan),
      };
    },
  );

  app.get(
    '/farms/:id/water',
    {
      schema: {
        tags,
        summary: '7-day forecast with an irrigation and spraying plan',
        description:
          'Forecast comes from Open-Meteo, or the simulator if it is unavailable (source says which).',
        security: bearer,
        params: IdParams,
        querystring: CropQuery,
        response: { 200: WaterDto, ...errors },
      },
    },
    async (req) => {
      const { farm, ref, profile, crop } = await context(req.user, req.params.id, req.query.crop);
      const forecast = await getForecast(farm.districtId, profile.season, ref);
      const plan = waterPlan(forecast.days, crop, profile.soil, ref);
      const first = plan.days.findIndex((d) => d.irr > 0);
      return {
        farmId: farm.id,
        cropId: crop.id,
        forecast,
        thresholdMm: plan.thr,
        days: plan.days,
        nextIrrigation: first >= 0 ? { date: forecast.days[first]!.date, mm: plan.days[first]!.irr } : null,
        sprayDays: forecast.days.filter((_, i) => plan.days[i]!.spray).map((d) => d.date),
        fungalRisk: fungalRisk(forecast.days),
      };
    },
  );

  app.get(
    '/farms/:id/mandi',
    {
      schema: {
        tags,
        summary: 'Prices in nearby mandis with sell or hold advice',
        security: bearer,
        params: IdParams,
        querystring: CropQuery,
        response: { 200: MandiDto, ...errors },
      },
    },
    async (req) => {
      const { farm, ref, crop } = await context(req.user, req.params.id, req.query.crop);
      return getMandi(crop, farm.districtId, ref);
    },
  );

  app.get(
    '/weather/:districtId',
    {
      schema: {
        tags,
        summary: '7-day forecast for a district',
        security: bearer,
        params: z.object({ districtId: z.string() }),
        querystring: z.object({ season: SeasonEnum.optional() }),
        response: { 200: ForecastDto, ...errors },
      },
    },
    async (req) => {
      const ref = await getReference();
      if (!ref.districts[req.params.districtId])
        throw badRequest('unknown_district', 'Pick a district from the list');
      return getForecast(req.params.districtId, req.query.season ?? seasonFor(new Date()), ref);
    },
  );

  app.get(
    '/mandi/:districtId/:cropId',
    {
      schema: {
        tags,
        summary: 'Mandi prices for a crop in a district',
        security: bearer,
        params: z.object({ districtId: z.string(), cropId: z.string() }),
        response: { 200: MandiDto, ...errors },
      },
    },
    async (req) => {
      const ref = await getReference();
      if (!ref.districts[req.params.districtId])
        throw badRequest('unknown_district', 'Pick a district from the list');
      return getMandi(cropById(ref, req.params.cropId), req.params.districtId, ref);
    },
  );

  app.post(
    '/diagnose',
    {
      schema: {
        tags,
        summary: 'Likely pests and diseases from the symptoms seen',
        description: 'Up to three matches, best first. Scores are symptom overlap, not a probability.',
        security: bearer,
        body: DiagnoseInput,
        response: { 200: z.object({ matches: z.array(PestMatchDto) }), ...errors },
      },
    },
    async (req) => {
      const ref = await getReference();
      cropById(ref, req.body.crop);
      const matches = matchPests(req.body.crop, req.body.symptoms, ref.pests);
      const top = matches[0];
      if (req.body.farmId && top && top.score >= REPORT_MIN_SCORE && top.pest.c[0] !== '*') {
        const farm = await farmFor(req.user, req.body.farmId, true);
        const d = await prisma.district.findUniqueOrThrow({ where: { id: farm.districtId } });
        await prisma.pestReport.create({
          data: {
            districtId: farm.districtId,
            farmId: farm.id,
            pestId: top.pest.id,
            lat: farm.lat ?? d.lat,
            lon: farm.lon ?? d.lon,
            source: 'diagnosis',
          },
        });
      }
      return { matches: matches.map((m) => ({ pestId: m.pest.id, score: m.score })) };
    },
  );
};

export default advisoryRoutes;
