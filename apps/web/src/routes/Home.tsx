import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicHeader } from '../components/PublicHeader';

/** Placeholder front page until the landing story in phase 5. */
export function Home() {
  const { t } = useTranslation();
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl font-display text-4xl text-fg sm:text-6xl">{t('home.title')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-fg-muted">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="btn-primary">
              {t('home.open')}
            </Link>
            <Link to="/design" className="btn-secondary">
              {t('home.design')}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
