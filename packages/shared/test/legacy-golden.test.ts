// The ported engine must reproduce the legacy app exactly. Fixtures come from scripts/capture-legacy-golden.mjs,
// which runs legacy/js/*.js unchanged in a sandbox.
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import {
  REFERENCE,
  fertPlan,
  forecastSim,
  mandiSim,
  matchPests,
  recommend,
  resources,
  translateReason,
  waterPlan,
  type FarmProfile,
  type Season,
} from '../src/index.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/legacy-golden.json', import.meta.url), 'utf8'));
const crop = (id: string) => REFERENCE.crops.find((c) => c.id === id)!;
const at = ([y, m, d]: number[]) => new Date(y!, m!, d!, 12, 0, 0);

let tEn: TFunction;
let tHi: TFunction;
beforeAll(async () => {
  const i = i18next.createInstance();
  await i.init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'advice'],
    interpolation: { escapeValue: false },
  });
  tEn = i.getFixedT('en', 'advice');
  tHi = i.getFixedT('hi', 'advice');
});

describe('recommend', () => {
  it(`matches ${golden.recommend.length} legacy cases`, () => {
    for (const { profile, out } of golden.recommend) {
      const r = recommend(profile as FarmProfile, REFERENCE);
      expect(r.water).toBe(out.water);
      expect(r.temp).toBe(out.temp);
      expect(r.out.map((c) => c.id)).toEqual(out.out);
      expect(r.list.map((x) => x.crop.id)).toEqual(out.list.map((x: { id: string }) => x.id));
      r.list.forEach((x, j) => {
        const g = out.list[j];
        expect(x.score).toBe(g.score);
        expect(x.reasons.map((q) => [q.ok ? 1 : 0, translateReason(tEn, 'en', q)])).toEqual(g.reasons);
        if (g.reasonsHi) expect(x.reasons.map((q) => translateReason(tHi, 'hi', q))).toEqual(g.reasonsHi);
      });
    }
  });
});

describe('fertPlan', () => {
  it(`matches ${golden.fert.length} legacy cases`, () => {
    for (const { profile, crop: id, out } of golden.fert) {
      expect(fertPlan(crop(id), profile, REFERENCE)).toEqual(out);
    }
  });
});

describe('forecastSim', () => {
  it(`matches ${golden.forecast.length} legacy cases`, () => {
    for (const { date, district, season, days } of golden.forecast) {
      const fc = forecastSim(district, season as Season, REFERENCE, at(date));
      expect(fc.map(({ date: d, ...rest }) => ({ ...rest, d }))).toEqual(
        days.map(({ d, ...rest }: { d: string }) => ({ ...rest, d })),
      );
    }
  });
});

describe('waterPlan', () => {
  it(`matches ${golden.water.length} legacy cases`, () => {
    for (const { date, district, season, soil, crop: id, out } of golden.water) {
      const fc = forecastSim(district, season as Season, REFERENCE, at(date));
      expect(waterPlan(fc, crop(id), soil, REFERENCE)).toEqual(out);
    }
  });
});

describe('mandiSim', () => {
  it(`matches ${golden.mandi.length} legacy cases`, () => {
    for (const { date, district, crop: id, out } of golden.mandi) {
      const md = mandiSim(crop(id), district, REFERENCE, at(date));
      expect(md.map((x) => ({ m: x.market, s: x.series, today: x.today, ch: x.change }))).toEqual(out);
    }
  });
});

describe('matchPests', () => {
  it(`matches ${golden.pests.length} legacy cases`, () => {
    for (const { crop: id, symptoms, out } of golden.pests) {
      expect(
        matchPests(id, symptoms, REFERENCE.pests).map((x) => ({ name: x.pest.n.en, sc: x.score })),
      ).toEqual(out);
    }
  });
});
