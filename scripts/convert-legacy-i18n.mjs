// Converts legacy/js/i18n.js (strings and template functions) into i18next JSON resources,
// and records what the legacy t() returned for sample arguments so a test can prove the
// new resources render the same text.
//
// Usage: npm run i18n:convert
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(root, 'legacy/js/i18n.js'), 'utf8') + '\nthis.T = T;', ctx);
const T = ctx.T;

// Keys the engine's reason / advice codes map to. Everything else is UI text.
const ADVICE = new Set([
  'r_soil',
  'r_soilx',
  'r_ph',
  'r_phx',
  'r_w',
  'r_wlow',
  'r_whigh',
  'r_t',
  'r_tx',
  'r_leg',
  'r_nlow',
  'basal',
  'basalLeg',
  'top1',
  'top2',
  'organic',
  'fertSay',
  'ph_ok',
  'ph_y',
  'ph_b',
  'ph_w',
  'irrNow',
  'irrNone',
  'fungal',
  'rising',
  'falling',
  'stable',
  'belowMsp',
]);

const params = (fn) => {
  const m = fn.toString().match(/^\s*\(?([^)=]*?)\)?\s*=>/);
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

// Functions that contain logic, not just interpolation, are split or rewritten by hand.
// Each entry: key -> { strings: {key: template}, samples: [[legacyArgs, newKey, newArgs]] }
const MANUAL = {
  basalLeg: (fn) => ({
    strings: {
      // valueOf satisfies the `u > 0` test; toString puts the placeholder in the text.
      basalLeg: fn('{{d}}', '{{m}}', { valueOf: () => 1, toString: () => '{{u}}' }),
      basalLeg_noUrea: fn('{{d}}', '{{m}}', 0),
    },
    samples: [
      [[40, 25, 12], 'basalLeg', { d: 40, m: 25, u: 12 }],
      [[40, 25, 0], 'basalLeg_noUrea', { d: 40, m: 25, u: 0 }],
    ],
  }),
  // kpi_wk formats a signed number; the caller now passes the formatted value as {{ch}}.
  kpi_wk: (fn) => ({
    strings: { kpi_wk: fn({ toFixed: () => '{{ch}}', valueOf: () => -1 }, '{{m}}') },
    samples: [
      [[2.345, 'Katol'], 'kpi_wk', { ch: '+2.3', m: 'Katol' }],
      [[-1.25, 'Katol'], 'kpi_wk', { ch: '-1.3', m: 'Katol' }],
    ],
  }),
};

const resources = {};
const samples = [];
for (const lang of Object.keys(T)) {
  resources[lang] = { common: {}, advice: {} };
  const walk = (obj, prefix, ns) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix + k;
      const target = ns ?? (ADVICE.has(k) ? 'advice' : 'common');
      if (typeof v === 'string') {
        setPath(resources[lang][target], key, v);
        samples.push({ lang, ns: target, key, args: {}, expected: v });
      } else if (typeof v === 'function') {
        if (MANUAL[k]) {
          const m = MANUAL[k](v);
          for (const [nk, s] of Object.entries(m.strings)) setPath(resources[lang][target], prefix + nk, s);
          for (const [legacyArgs, nk, newArgs] of m.samples)
            samples.push({ lang, ns: target, key: prefix + nk, args: newArgs, expected: v(...legacyArgs) });
          continue;
        }
        const names = params(v);
        const tpl = v(...names.map((n) => `{{${n}}}`));
        if (names.some((n) => !tpl.includes(`{{${n}}}`)))
          throw new Error(`${lang}.${key} drops a parameter; add a MANUAL rule`);
        setPath(resources[lang][target], key, tpl);
        const sample = Object.fromEntries(names.map((n, i) => [n, `«${n}${i}»`]));
        samples.push({ lang, ns: target, key, args: sample, expected: v(...names.map((n) => sample[n])) });
      } else if (v && typeof v === 'object') {
        walk(v, key + '.', target);
      }
    }
  };
  walk(T[lang], '', null);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)] = value;
}

for (const lang of Object.keys(resources))
  for (const ns of Object.keys(resources[lang]))
    writeFileSync(
      join(root, `packages/shared/src/i18n/locales/${lang}/${ns}.json`),
      JSON.stringify(resources[lang][ns], null, 2) + '\n',
    );
writeFileSync(join(root, 'packages/shared/test/fixtures/legacy-i18n.json'), JSON.stringify(samples, null, 1));
console.log(`Converted ${Object.keys(resources).join(', ')}; ${samples.length} samples recorded`);
