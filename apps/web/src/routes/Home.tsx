import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Home() {
  const { t } = useTranslation();
  return (
    <section className="py-16 sm:py-24">
      <h1 className="max-w-3xl font-display text-4xl text-fg sm:text-6xl">{t('home.title')}</h1>
      <p className="mt-4 max-w-2xl text-lg text-fg-muted">{t('home.lead')}</p>
      <Link to="/design" className="btn-primary mt-8">
        {t('home.design')}
      </Link>
    </section>
  );
}
