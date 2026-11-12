import type { Farm, SoilTest } from '@prisma/client';
import { SeasonEnum, type FarmProfile, type ReferenceData } from '@fieldwise/shared';
import { prisma } from '../db.js';

/** Medium Soil Health Card values, used until the farmer adds a test. */
const DEFAULT_NPK = { N: 400, P: 17, K: 200 };

/** The engine's view of a farm: its details plus the latest Soil Health Card, or district defaults. */
export function farmProfile(
  farm: Farm,
  latest: SoilTest | null,
  ref: ReferenceData,
): { profile: FarmProfile; usingDefaults: boolean } {
  const district = ref.districts[farm.districtId];
  const base = {
    district: farm.districtId,
    season: SeasonEnum.parse(farm.season),
    soil: farm.soil,
    irrigation: farm.irrigation,
    area: farm.areaAcres,
  };
  if (latest)
    return {
      profile: { ...base, ph: latest.ph, N: latest.n, P: latest.p, K: latest.k },
      usingDefaults: false,
    };
  return { profile: { ...base, ph: district?.ph ?? 7, ...DEFAULT_NPK }, usingDefaults: true };
}

export const latestSoilTest = (farmId: string): Promise<SoilTest | null> =>
  prisma.soilTest.findFirst({ where: { farmId }, orderBy: { testedAt: 'desc' } });
