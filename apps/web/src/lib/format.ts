import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, pick, translateReason, type Labels } from '@fieldwise/shared';
import type { ReasonDto } from './api-types';

const localeOf = (lang: string) => LANGUAGES.find((l) => l.code === lang)?.locale ?? 'en-IN';

/** Language-aware helpers: pick labels, render engine reasons, format numbers and dates. */
export function useFmt() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const locale = localeOf(lang);
  const label = useCallback((l: Labels | null | undefined) => pick(l, lang), [lang]);
  const reason = useCallback(
    (r: Pick<ReasonDto, 'key' | 'args'>) =>
      translateReason((k, a) => t(k, { ...a, ns: 'advice' }), lang, r as never),
    [t, lang],
  );
  const num = useCallback(
    (n: number, digits = 0) =>
      n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }),
    [locale],
  );
  const money = useCallback((n: number) => `₹${Math.round(n).toLocaleString(locale)}`, [locale]);
  const signed = useCallback(
    (n: number, digits = 1) =>
      `${n >= 0 ? '+' : ''}${n.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`,
    [locale],
  );
  /** YYYY-MM-DD or ISO → localised date */
  const date = useCallback(
    (d: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
      new Date(typeof d === 'string' && d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(
        locale,
        opts,
      ),
    [locale],
  );
  const time = useCallback(
    (d: string | Date) =>
      new Date(d).toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [locale],
  );
  /** Season label without the month range, e.g. "Rabi" */
  const short = useCallback((l: Labels | null | undefined) => pick(l, lang).split(' (')[0]!, [lang]);
  return { t, lang, locale, label, reason, num, money, signed, date, time, short };
}
