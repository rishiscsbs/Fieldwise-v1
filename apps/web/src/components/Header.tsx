import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '@fieldwise/shared';
import { resolvedTheme, useUi } from '../stores/ui';

export function Header() {
  const { t } = useTranslation();
  const { lang, setLang, theme, setTheme } = useUi();
  const current = resolvedTheme(theme);

  return (
    <header className="border-b border-line bg-surface/80 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('skip')}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-display text-2xl text-fg">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          {t('brand')}
        </Link>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="lang">
            {t('language')}
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="min-h-11 rounded-md border border-line bg-surface px-2 text-base"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            aria-pressed={current === 'dark'}
            onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
          >
            {current === 'dark' ? t('theme.light') : t('theme.dark')}
          </button>
        </div>
      </div>
    </header>
  );
}
