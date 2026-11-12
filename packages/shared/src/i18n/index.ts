/* UI strings for every language, as i18next resources.
   common + advice are converted from legacy/js/i18n.js (npm run i18n:convert); new v2 strings go in app.
   To add a language: create locales/<code>/{common,advice,app}.json, import them below and add an entry to LANGUAGES.
   Missing keys fall back to English. Reference data labels (crops, pests, districts) carry their own
   per-language text in the database and also fall back to English. */
import enCommon from './locales/en/common.json' with { type: 'json' };
import enAdvice from './locales/en/advice.json' with { type: 'json' };
import enApp from './locales/en/app.json' with { type: 'json' };
import hiCommon from './locales/hi/common.json' with { type: 'json' };
import hiAdvice from './locales/hi/advice.json' with { type: 'json' };
import hiApp from './locales/hi/app.json' with { type: 'json' };
import type { Labels } from '../types.js';
import type { Reason } from '../engine/recommend.js';
import { pick } from '../engine/util.js';

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', locale: 'en-IN', speech: 'en-IN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', speech: 'hi-IN' },
] as const;

export type LangCode = (typeof LANGUAGES)[number]['code'];
export const DEFAULT_LANG: LangCode = 'en';
export const NAMESPACES = ['common', 'advice', 'app'] as const;

export const resources = {
  en: { common: enCommon, advice: enAdvice, app: enApp },
  hi: { common: hiCommon, advice: hiAdvice, app: hiApp },
} as const;

type TFn = (key: string, args?: Record<string, unknown>) => string;

const isLabels = (v: unknown): v is Labels => typeof v === 'object' && v !== null && 'en' in v;

/** Interpolation values for a reason, with Labels args resolved to the given language. */
export function reasonArgs(r: Pick<Reason, 'args'>, lang: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(r.args ?? {})) out[k] = isLabels(v) ? pick(v, lang) : v;
  return out;
}

/** Render an engine reason or advice code with an i18next `t` bound to the `advice` namespace. */
export const translateReason = (t: TFn, lang: string, r: Pick<Reason, 'key' | 'args'>): string =>
  t(r.key, reasonArgs(r, lang));
