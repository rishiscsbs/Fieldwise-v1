// Unit tests for engine pieces that lived in the legacy UI code (no golden fixture).
import { describe, expect, it } from 'vitest';
import {
  FarmInput,
  Phone,
  REFERENCE,
  activeCrop,
  fertPlan,
  fertSchedule,
  fungalRisk,
  leafColours,
  leafFindings,
  marketAdvice,
  seasonFor,
  type FarmProfile,
} from '../src/index.js';

const px = (rgb: number[], n = 100) => Array.from({ length: n }, () => [...rgb, 255]).flat();
const crop = (id: string) => REFERENCE.crops.find((c) => c.id === id)!;
const profile: FarmProfile = {
  district: 'nagpur',
  season: 'kharif',
  soil: 'black',
  irrigation: 'partial',
  ph: 7.6,
  N: 240,
  P: 14,
  K: 310,
  area: 2,
};

describe('leafColours', () => {
  it('buckets pure colours by hue', () => {
    expect(leafColours(px([40, 160, 50])).green).toBe(100);
    expect(leafColours(px([210, 190, 40])).yellow).toBe(100);
    expect(leafColours(px([120, 60, 30])).brown).toBe(100);
    expect(leafColours(px([240, 240, 240])).white).toBe(100);
  });
  it('ignores dark and grey background pixels', () => {
    const c = leafColours([...px([10, 10, 10]), ...px([128, 128, 128]), ...px([40, 160, 50])]);
    expect(c.green).toBe(100);
  });
  it('returns zeros for an empty image', () => {
    expect(leafColours([])).toEqual({ green: 0, yellow: 0, brown: 0, white: 0 });
  });
});

describe('leafFindings', () => {
  it('flags yellow, brown and white thresholds', () => {
    expect(leafFindings({ green: 50, yellow: 25, brown: 13, white: 12 })).toEqual({
      keys: ['ph_y', 'ph_b', 'ph_w'],
      symptoms: ['yellow', 'spots', 'powder'],
    });
  });
  it('says healthy when nothing crosses a threshold', () => {
    expect(leafFindings({ green: 90, yellow: 5, brown: 5, white: 0 })).toEqual({
      keys: ['ph_ok'],
      symptoms: [],
    });
  });
});

describe('fertSchedule', () => {
  it('splits urea in three for cereals', () => {
    const c = crop('rice');
    const s = fertSchedule(c, fertPlan(c, profile, REFERENCE));
    expect(s.map((x) => x.key)).toEqual(['basal', 'top1', 'top2']);
    expect(s[1]!.args!.u).toBe(s[0]!.args!.u);
  });
  it('gives pulses a single basal dose', () => {
    const c = crop('moong');
    const s = fertSchedule(c, fertPlan(c, profile, REFERENCE));
    expect(s).toHaveLength(1);
    expect(s[0]!.key).toMatch(/^basalLeg/);
  });
});

describe('marketAdvice', () => {
  const md = (chs: number[], today = 3000) =>
    chs.map((change, i) => ({ market: `M${i}`, today: today + i, change }));
  it('reads the average weekly change', () => {
    expect(marketAdvice(md([3, 2, 4]), { msp: null }).key).toBe('rising');
    expect(marketAdvice(md([-3, -2, -4]), { msp: null }).key).toBe('falling');
    expect(marketAdvice(md([1, -1, 0]), { msp: null }).key).toBe('stable');
  });
  it('prefers MSP advice when the best market is below MSP', () => {
    const r = marketAdvice(md([5, 5], 2000), { msp: 2500 });
    expect(r.key).toBe('belowMsp');
    expect(r.best.market).toBe('M1');
  });
});

describe('fungalRisk', () => {
  const day = (hum: number) => ({ hum, tmax: 30, tmin: 20 });
  it('needs three humid, mild days in a row', () => {
    expect(fungalRisk([day(85), day(85), day(85), day(50)])).toBe(true);
    expect(fungalRisk([day(85), day(85), day(50), day(85)])).toBe(false);
  });
});

describe('activeCrop', () => {
  it('keeps an in-season choice and replaces an out-of-season one', () => {
    expect(activeCrop(profile, 'cotton', REFERENCE).id).toBe('cotton');
    expect(activeCrop(profile, 'wheat', REFERENCE).s).toContain('kharif');
  });
});

describe('seasonFor', () => {
  it('maps months to seasons', () => {
    expect(seasonFor(new Date(2026, 6, 1))).toBe('kharif');
    expect(seasonFor(new Date(2026, 10, 1))).toBe('rabi');
    expect(seasonFor(new Date(2026, 3, 1))).toBe('zaid');
  });
});

describe('schemas', () => {
  it('normalises Indian phone numbers', () => {
    expect(Phone.parse('98765 43210')).toBe('+919876543210');
    expect(Phone.parse('+91-98765-43210')).toBe('+919876543210');
    expect(Phone.safeParse('12345').success).toBe(false);
  });
  it('validates farm input', () => {
    const ok = FarmInput.safeParse({
      name: 'North field',
      districtId: 'nagpur',
      soil: 'black',
      irrigation: 'partial',
      areaAcres: 2,
      season: 'rabi',
    });
    expect(ok.success).toBe(true);
    expect(FarmInput.safeParse({ name: '', districtId: 'x' }).success).toBe(false);
  });
});
