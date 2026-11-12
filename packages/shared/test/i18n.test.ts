// Every legacy string, rendered through the converted i18next resources, must equal what legacy t() produced.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { LANGUAGES, resources } from '../src/index.js';

interface Sample {
  lang: string;
  ns: string;
  key: string;
  args: Record<string, unknown>;
  expected: string;
}
const samples: Sample[] = JSON.parse(
  readFileSync(new URL('./fixtures/legacy-i18n.json', import.meta.url), 'utf8'),
);

describe('converted i18n resources', () => {
  it(`render all ${samples.length} legacy samples identically`, async () => {
    const i = i18next.createInstance();
    await i.init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      ns: ['common', 'advice'],
      interpolation: { escapeValue: false },
    });
    for (const s of samples) {
      expect(i.getFixedT(s.lang, s.ns)(s.key, s.args), `${s.lang}:${s.ns}:${s.key}`).toBe(s.expected);
    }
  });

  it('has the same keys in every language', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    const en = resources.en;
    for (const { code } of LANGUAGES) {
      const r = resources[code];
      expect(keys(r.common).sort()).toEqual(keys(en.common).sort());
      expect(keys(r.advice).sort()).toEqual(keys(en.advice).sort());
      expect(keys(r.app).sort()).toEqual(keys(en.app).sort());
    }
  });
});
