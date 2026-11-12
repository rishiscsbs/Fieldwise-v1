// One-time port of legacy/js/data.js into packages/shared/src/data/reference.ts.
// Values are copied as-is; pests gain a stable `id` slug. District coordinates live in geo.ts.
//
// Usage: node scripts/port-legacy-data.mjs
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(readFileSync(join(root, 'legacy/js/data.js'), 'utf8'), ctx);
const get = (n) => vm.runInContext(`JSON.stringify(${n})`, ctx);

const slug = (s) =>
  s
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const pests = JSON.parse(get('PESTS')).map((p) => ({ id: slug(p.n.en), ...p }));
if (new Set(pests.map((p) => p.id)).size !== pests.length) throw new Error('Duplicate pest slug');

const src = `/* Fieldwise reference data, ported from legacy/js/data.js by scripts/port-legacy-data.mjs.
   Values are indicative and meant for a prototype. Do not edit by hand without updating the golden tests. */
import type { Crop, District, Fertiliser, IrrigationLevel, Labels, Pest } from '../types.js';

export const DISTRICTS: Record<string, District> = ${get('DISTRICTS')};

export const SOILS: Record<string, Labels> = ${get('SOILS')};

/** mm allowable depletion before irrigation */
export const SOIL_TAW: Record<string, number> = ${get('SOIL_TAW')};

export const SEASONS: Record<string, Labels> = ${get('SEASONS')};

export const RAIN_SHARE: Record<string, number> = ${get('RAIN_SHARE')};

export const IRR: Record<string, IrrigationLevel> = ${get('IRR')};

/** npk = recommended kg/ha N, P2O5, K2O; w = seasonal water mm; y = yield q/acre; p = price ₹/q indicative; msp = ₹/q (null = no MSP) */
export const CROPS: Crop[] = ${get('CROPS')};

export const SYM: Record<string, Labels> = ${get('SYM')};

export const PESTS: Pest[] = ${JSON.stringify(pests)};

export const FERT: Record<'urea' | 'dap' | 'mop', Fertiliser> = ${get('FERT')};
`;
writeFileSync(join(root, 'packages/shared/src/data/reference.ts'), src);
console.log(`Wrote reference.ts with ${pests.length} pests: ${pests.map((p) => p.id).join(', ')}`);
