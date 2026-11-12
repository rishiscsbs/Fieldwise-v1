// Reference data, loaded from the database and cached briefly. Admin edits call invalidateReference().
import { REFERENCE, SEASONS, SYM, type ReferenceData, type ReferenceDto } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { loadReference } from '../lib/reference.js';
import { parseLabels } from '../lib/json.js';

const TTL_MS = 60_000;
let cached: { at: number; ref: ReferenceData } | null = null;

export async function getReference(): Promise<ReferenceData> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.ref;
  const ref = await loadReference(prisma);
  cached = { at: Date.now(), ref };
  return ref;
}

export function invalidateReference(): void {
  cached = null;
}

/** Everything the app needs to render forms and labels, in one response. */
export async function referenceDto(): Promise<ReferenceDto> {
  const ref = await getReference();
  const [districts, soils, symptoms, ferts] = await Promise.all([
    prisma.district.findMany({
      where: { active: true },
      include: { markets: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.soil.findMany(),
    prisma.symptom.findMany(),
    prisma.fertiliser.findMany(),
  ]);
  const symptomOrder = Object.keys(SYM);
  return {
    crops: ref.crops,
    pests: ref.pests,
    districts: districts.map((d) => ({
      id: d.id,
      labels: parseLabels(d.labels),
      lat: d.lat,
      lon: d.lon,
      soil: d.soil,
      ph: d.ph,
      rainMm: d.rainMm,
      temp: { kharif: d.tempKharif, rabi: d.tempRabi, zaid: d.tempZaid },
      markets: d.markets.map((m) => m.name),
    })),
    soils: soils.map((s) => ({ id: s.id, labels: parseLabels(s.labels), taw: s.taw })),
    seasons: (['kharif', 'rabi', 'zaid'] as const).map((id) => ({ id, labels: SEASONS[id]! })),
    irrigation: Object.entries(REFERENCE.irrigation).map(([id, v]) => ({
      id,
      labels: { en: v.en, hi: v.hi },
      mm: v.mm,
    })),
    symptoms: symptoms
      .map((s) => ({ id: s.id, labels: parseLabels(s.labels) }))
      .sort((a, b) => symptomOrder.indexOf(a.id) - symptomOrder.indexOf(b.id)),
    fertilisers: ferts.map((f) => ({
      id: f.id,
      labels: parseLabels(f.labels),
      bagKg: f.bagKg,
      cost: f.cost,
      colour: f.colour,
    })),
  };
}
