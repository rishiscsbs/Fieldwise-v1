// Runs the legacy engine (legacy/js/*.js) in a sandbox and records its outputs.
// packages/shared/test/legacy-golden.test.ts checks the ported engine against this file,
// so the port reproduces the old numbers exactly instead of relying on memory.
//
// Usage: npm run golden
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'packages/shared/test/fixtures/legacy-golden.json');

// Fixed dates at local noon, so toDateString() is the same in every timezone.
const DATES = [
  [2026, 10, 12],
  [2026, 6, 3],
  [2027, 3, 20],
];

function sandbox(y, m, d) {
  const fixed = new Date(y, m, d, 12, 0, 0).getTime();
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [fixed]));
    }
    static now() {
      return fixed;
    }
  }
  const ctx = vm.createContext({ Date: FixedDate, Math, JSON, console });
  for (const f of ['data.js', 'i18n.js', 'core.js', 'engine.js']) {
    vm.runInContext(readFileSync(join(root, 'legacy/js', f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const run = (ctx, code) => vm.runInContext(code, ctx);
const setP = (ctx, p) => run(ctx, `P = ${JSON.stringify({ crop: null, ...p })}; lang = 'en';`);
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ctx = sandbox(...DATES[0]);
const DISTRICTS = run(ctx, 'Object.keys(DISTRICTS)');
const SOILS = run(ctx, 'Object.keys(SOILS)');
const SEASONS = ['kharif', 'rabi', 'zaid'];
const IRRS = ['none', 'partial', 'full'];
const CROPS = run(ctx, 'CROPS.map(c => c.id)');
const SYMS = run(ctx, 'Object.keys(SYM)');

// Soil Health Card variants: low / medium / high nutrient profiles and pH spread.
const SHC = [
  { ph: 7.6, N: 240, P: 14, K: 310 },
  { ph: 5.4, N: 600, P: 30, K: 90 },
  { ph: 8.6, N: 300, P: 8, K: 200 },
];

const golden = {
  generatedFrom: 'legacy/js',
  dates: DATES,
  recommend: [],
  fert: [],
  forecast: [],
  water: [],
  mandi: [],
  pests: [],
};

// --- recommend: every district x season x soil x irrigation, with rotating SHC values.
let i = 0;
for (const district of DISTRICTS)
  for (const season of SEASONS)
    for (const soil of SOILS)
      for (const irrigation of IRRS) {
        const shc = SHC[i % SHC.length];
        const profile = { district, season, soil, irrigation, area: 2, ...shc };
        setP(ctx, profile);
        const r = JSON.parse(
          run(
            ctx,
            `JSON.stringify((() => { const r = recommend(); return {
          water: r.water, temp: r.temp, out: r.out.map(c => c.id),
          list: r.list.map(x => ({ id: x.c.id, score: x.score, reasons: x.R.map(q => [q[0], q[1]]) })) }; })())`,
          ),
        );
        if (i % 4 === 0) {
          run(ctx, `lang = 'hi'`);
          const hi = JSON.parse(run(ctx, 'JSON.stringify(recommend().list.map(x => x.R.map(q => q[1])))'));
          r.list.forEach((x, j) => (x.reasonsHi = hi[j]));
        }
        golden.recommend.push({ profile, out: r });
        i++;
      }

// --- fertPlan: every crop x every N/P/K level combination x two field sizes.
const LV = { N: [200, 400, 600], P: [8, 15, 30], K: [100, 200, 300] };
for (const crop of CROPS)
  for (const N of LV.N)
    for (const P of LV.P)
      for (const K of LV.K)
        for (const area of [1, 3.5]) {
          const profile = {
            district: 'nagpur',
            season: 'kharif',
            soil: 'black',
            irrigation: 'partial',
            ph: 7,
            N,
            P,
            K,
            area,
          };
          setP(ctx, profile);
          const r = JSON.parse(run(ctx, `JSON.stringify(fertPlan(C('${crop}')))`));
          golden.fert.push({ profile, crop, out: r });
        }

// --- forecast, waterPlan and mandiData on each fixed date.
for (const date of DATES) {
  const c = sandbox(...date);
  for (const district of DISTRICTS)
    for (const season of SEASONS) {
      setP(c, {
        district,
        season,
        soil: 'black',
        irrigation: 'partial',
        ph: 7,
        N: 300,
        P: 15,
        K: 200,
        area: 2,
      });
      const fc = JSON.parse(run(c, 'JSON.stringify(forecast().map(f => ({ ...f, d: f.d.getTime() })))')).map(
        (f) => ({
          ...f,
          d: ymd(new Date(f.d)),
        }),
      );
      golden.forecast.push({ date, district, season, days: fc });
      for (const soil of SOILS) {
        const crop = CROPS[(DISTRICTS.indexOf(district) + SOILS.indexOf(soil)) % CROPS.length];
        run(c, `P.soil = '${soil}'`);
        const w = JSON.parse(run(c, `JSON.stringify(waterPlan(forecast(), C('${crop}')))`));
        golden.water.push({ date, district, season, soil, crop, out: w });
      }
    }
  for (const district of DISTRICTS)
    for (const crop of CROPS) {
      setP(c, {
        district,
        season: 'kharif',
        soil: 'black',
        irrigation: 'partial',
        ph: 7,
        N: 300,
        P: 15,
        K: 200,
        area: 2,
      });
      const md = JSON.parse(run(c, `JSON.stringify(mandiData(C('${crop}')))`));
      golden.mandi.push({ date, district, crop, out: md });
    }
}

// --- pest matcher. Copied verbatim from legacy/js/app.js diagnose(), minus the DOM writes.
run(
  ctx,
  `function legacyDiagnose(pestCrop, symSel) {
  return PESTS.filter(p => p.c.includes(pestCrop) || p.c.includes('*')).map(p => {
    const m = p.s.filter(s => symSel.includes(s)).length; let sc = 2 * m / (p.s.length + symSel.length);
    if (p.c.includes('*')) sc *= .8; return { p, sc: Math.round(sc * 100) };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3);
}`,
);
const symSets = [
  ...SYMS.map((s) => [s]),
  ...SYMS.flatMap((a, x) => SYMS.slice(x + 1).map((b) => [a, b])).filter((_, k) => k % 3 === 0),
  ['yellow', 'spots', 'tipburn'],
  ['sticky', 'curl', 'yellow', 'stunted'],
  ['holes', 'fruitrot', 'deadheart'],
  ['wilt', 'yellow', 'stunted'],
  ['powder', 'spots', 'yellow', 'webbing'],
];
for (const crop of CROPS)
  for (const symptoms of symSets) {
    const r = JSON.parse(
      run(
        ctx,
        `JSON.stringify(legacyDiagnose('${crop}', ${JSON.stringify(symptoms)}).map(x => ({ name: x.p.n.en, sc: x.sc })))`,
      ),
    );
    golden.pests.push({ crop, symptoms, out: r });
  }

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(golden));
console.log(
  `Wrote ${out}: ${golden.recommend.length} recommend, ${golden.fert.length} fert, ${golden.forecast.length} forecast, ` +
    `${golden.water.length} water, ${golden.mandi.length} mandi, ${golden.pests.length} pest cases`,
);
