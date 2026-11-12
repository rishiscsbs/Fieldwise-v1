// Converts reference data between the engine's shape (packages/shared) and database rows.
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  DISTRICT_GEO,
  REFERENCE,
  SYM,
  type Crop,
  type District,
  type Pest,
  type ReferenceData,
} from '@fieldwise/shared';
import { parseLabels, parseList, toJson } from './json.js';

type Db = PrismaClient | Prisma.TransactionClient;

export function districtRow(id: string, d: District): Prisma.DistrictCreateInput {
  const geo = DISTRICT_GEO[id];
  if (!geo) throw new Error(`No coordinates for district ${id}`);
  return {
    id,
    labels: toJson(d.name),
    lat: geo.lat,
    lon: geo.lon,
    rainMm: d.rain,
    tempKharif: d.temp.kharif,
    tempRabi: d.temp.rabi,
    tempZaid: d.temp.zaid,
    soil: d.soil,
    ph: d.ph,
    markets: { create: d.mk.map((name, sortOrder) => ({ name, sortOrder })) },
  };
}

export const cropRow = (c: Crop, sortOrder: number): Prisma.CropCreateInput => ({
  id: c.id,
  emoji: c.e,
  labels: toJson(c.n),
  seasons: toJson(c.s),
  soils: toJson(c.soil),
  phMin: c.ph[0]!,
  phMax: c.ph[1]!,
  waterMin: c.w[0]!,
  waterMax: c.w[1]!,
  tempMin: c.t[0]!,
  tempMax: c.t[1]!,
  nKgHa: c.npk[0]!,
  pKgHa: c.npk[1]!,
  kKgHa: c.npk[2]!,
  kc: c.kc,
  duration: c.d,
  yield: c.y,
  msp: c.msp,
  price: c.p,
  legume: !!c.leg,
  sortOrder,
});

export const pestRow = (p: Pest): Prisma.PestCreateInput => ({
  id: p.id,
  labels: toJson(p.n),
  crops: toJson(p.c),
  symptoms: toJson(p.s),
  organic: toJson(p.o),
  chemical: toJson(p.ch),
  prevention: toJson(p.pv),
});

/** Writes the built-in reference tables. Used by the seed. */
export async function seedReference(db: Db): Promise<void> {
  for (const [id, d] of Object.entries(REFERENCE.districts))
    await db.district.create({ data: districtRow(id, d) });
  for (const [id, labels] of Object.entries(REFERENCE.soils))
    await db.soil.create({ data: { id, labels: toJson(labels), taw: REFERENCE.soilTaw[id]! } });
  for (const [id, labels] of Object.entries(SYM))
    await db.symptom.create({ data: { id, labels: toJson(labels) } });
  for (const [i, c] of REFERENCE.crops.entries()) await db.crop.create({ data: cropRow(c, i) });
  for (const p of REFERENCE.pests) await db.pest.create({ data: pestRow(p) });
  for (const [id, f] of Object.entries(REFERENCE.fertilisers))
    await db.fertiliser.create({
      data: { id, labels: toJson(f.n), bagKg: f.bag, cost: f.cost, colour: f.col },
    });
}

/** Loads reference data from the database in the shape the engine expects. Admin edits take effect here. */
export async function loadReference(db: Db): Promise<ReferenceData> {
  const [districts, soils, crops, pests, ferts] = await Promise.all([
    db.district.findMany({
      where: { active: true },
      include: { markets: { orderBy: { sortOrder: 'asc' } } },
    }),
    db.soil.findMany(),
    db.crop.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    db.pest.findMany(),
    db.fertiliser.findMany(),
  ]);
  const fert = Object.fromEntries(
    ferts.map((f) => [f.id, { n: parseLabels(f.labels), bag: f.bagKg, cost: f.cost, col: f.colour }]),
  ) as ReferenceData['fertilisers'];
  return {
    districts: Object.fromEntries(
      districts.map((d) => [
        d.id,
        {
          name: parseLabels(d.labels),
          rain: d.rainMm,
          temp: { kharif: d.tempKharif, rabi: d.tempRabi, zaid: d.tempZaid },
          soil: d.soil,
          ph: d.ph,
          mk: d.markets.map((m) => m.name),
        },
      ]),
    ),
    soils: Object.fromEntries(soils.map((s) => [s.id, parseLabels(s.labels)])),
    soilTaw: Object.fromEntries(soils.map((s) => [s.id, s.taw])),
    rainShare: REFERENCE.rainShare,
    irrigation: REFERENCE.irrigation,
    crops: crops.map((c) => ({
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
    })),
    pests: pests.map((p) => ({
      id: p.id,
      n: parseLabels(p.labels),
      c: parseList(p.crops),
      s: parseList(p.symptoms),
      o: parseLabels(p.organic),
      ch: parseLabels(p.chemical),
      pv: parseLabels(p.prevention),
    })),
    fertilisers: fert,
  };
}
