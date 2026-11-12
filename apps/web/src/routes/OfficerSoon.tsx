import { Link } from 'react-router-dom';
import { useFmt } from '../lib/format';
import { Callout, PageHeader } from '../components/ui';

/** Placeholder until the officer dashboard (phase 4). */
export function OfficerSoon() {
  const { t } = useFmt();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('shell.officerSoon')} />
      <Callout tone="info" title={t('officer.soon')} />
      <Link to="/app/desk" className="btn-primary self-start">
        {t('nav2.desk', { ns: 'common' })}
      </Link>
    </div>
  );
}
