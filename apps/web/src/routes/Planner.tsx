import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useChooseCrop } from '../lib/choose';
import { useRecommendations, useReference } from '../lib/queries';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Badge, Callout, Card, ErrorState, PageHeader, PageSkeleton, ScoreBar } from '../components/ui';

export function Planner() {
  const { t, label, short, money, num, reason } = useFmt();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const recs = useRecommendations(farm?.id);
  const choose = useChooseCrop(ref.data);
  const chosen = farm?.crop ?? recs.data?.activeCrop;
  const season = ref.data?.seasons.find((s) => s.id === farm?.season);
  const first = recs.data?.list[0];
  const firstCrop = ref.data?.crops.find((c) => c.id === first?.cropId);

  useSay(
    firstCrop
      ? `${t('crops_lead', { ns: 'common', c: label(firstCrop.n), s: short(season?.labels) })}. ${t('crops_sub', { ns: 'common' })}`
      : undefined,
  );

  if (recs.isError) return <ErrorState onRetry={() => void recs.refetch()} />;
  if (!farm || !ref.data || !recs.data || !firstCrop) return <PageSkeleton cards={6} />;

  const crop = (id: string) => ref.data!.crops.find((c) => c.id === id)!;
  const out = recs.data.out.map(crop);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('crops_lead', { ns: 'common', c: label(firstCrop.n), s: short(season?.labels) })}
        sub={t('crops_sub', { ns: 'common' })}
      />
      {recs.data.usingDefaults && <Callout tone="info" title={t('defaults')} />}

      <ol className="grid gap-4 md:grid-cols-2">
        {recs.data.list.map((x, i) => {
          const c = crop(x.cropId);
          const isChosen = x.cropId === chosen;
          const warns = x.reasons.filter((r) => !r.ok);
          const income = c.y * c.p * farm.areaAcres;
          return (
            <m.li
              key={x.cropId}
              layoutId={`crop-${x.cropId}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(i, 8) * 0.04,
                layout: { type: 'spring', stiffness: 300, damping: 34 },
              }}
              className={`card flex flex-col gap-3 ${isChosen ? 'ring-2 ring-accent' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <m.h2
                  layoutId={`crop-title-${x.cropId}`}
                  className="flex items-center gap-2 text-xl font-semibold"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {c.e}
                  </span>
                  {label(c.n)}
                </m.h2>
                <div className="flex flex-wrap justify-end gap-1">
                  {i === 0 && <Badge tone="good">{t('top', { ns: 'common' })}</Badge>}
                  {isChosen && (
                    <span className="badge bg-accent-soft text-fg">{t('chosen', { ns: 'common' })}</span>
                  )}
                </div>
              </div>
              <ScoreBar value={x.score} tone={isChosen ? 'accent' : 'primary'} />
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-fg-muted">{t('duration', { ns: 'common' })}</dt>
                  <dd className="num font-semibold">
                    {c.d} {t('days', { ns: 'common' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t('yield', { ns: 'common' })}</dt>
                  <dd className="num font-semibold">
                    {num(c.y, 1)} {t('qpa', { ns: 'common' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t('income', { ns: 'common' })}</dt>
                  <dd className="num font-semibold">{money(income)}</dd>
                </div>
              </dl>
              {warns.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {warns.slice(0, 2).map((r) => (
                    <li key={r.key} className="flex items-start gap-2 text-fg-muted">
                      <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-warn" />
                      {reason(r)}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                {!isChosen && (
                  <Button variant="primary" onClick={(e) => choose(x.cropId, e.currentTarget)}>
                    {t('choose', { ns: 'common' })}
                  </Button>
                )}
                <Link to={`/app/planner/${x.cropId}`} className="btn-quiet">
                  {t('planner.details')}
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            </m.li>
          );
        })}
      </ol>

      {out.length > 0 && (
        <Card title={t('planner.outOfSeason')}>
          <p className="text-fg-muted">
            {t('notSeason', { ns: 'common', n: out.map((c) => label(c.n)).join(', ') })}
          </p>
        </Card>
      )}
    </div>
  );
}
