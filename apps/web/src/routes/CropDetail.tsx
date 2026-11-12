import { Link, useParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useChooseCrop } from '../lib/choose';
import { useRecommendations, useReference } from '../lib/queries';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Badge, Card, ErrorState, PageSkeleton, ScoreBar } from '../components/ui';

/** One crop: the card from the planner expands into this page (shared layout id). */
export function CropDetail() {
  const { cropId = '' } = useParams();
  const { t, label, money, num, reason } = useFmt();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const recs = useRecommendations(farm?.id);
  const choose = useChooseCrop(ref.data);
  const crop = ref.data?.crops.find((c) => c.id === cropId);
  const scored = recs.data?.list.find((x) => x.cropId === cropId);

  useSay(
    crop && scored
      ? `${label(crop.n)}. ${t('score', { ns: 'common' })} ${scored.score}. ${scored.reasons.map(reason).join('. ')}`
      : undefined,
  );

  if (recs.isError) return <ErrorState onRetry={() => void recs.refetch()} />;
  if (!farm || !ref.data || !recs.data) return <PageSkeleton cards={2} />;
  if (!crop) return <ErrorState />;

  const chosen = (farm.crop ?? recs.data.activeCrop) === crop.id;
  const list = (ids: string[], src: { id: string; labels: Parameters<typeof label>[0] }[]) =>
    ids.map((id) => label(src.find((x) => x.id === id)?.labels).split(' (')[0]).join(', ');

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app/planner" className="btn-quiet self-start">
        <Icon name="arrowLeft" size={16} />
        {t('planner.back')}
      </Link>

      <m.section
        layoutId={`crop-${crop.id}`}
        transition={{ layout: { type: 'spring', stiffness: 300, damping: 34 } }}
        className={`card flex flex-col gap-4 sm:p-8 ${chosen ? 'ring-2 ring-accent' : ''}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <m.h1
            layoutId={`crop-title-${crop.id}`}
            className="flex items-center gap-3 font-display text-3xl sm:text-4xl"
          >
            <span aria-hidden="true">{crop.e}</span>
            {label(crop.n)}
          </m.h1>
          {chosen ? (
            <span className="badge bg-accent-soft text-fg">{t('chosen', { ns: 'common' })}</span>
          ) : scored ? (
            <Button variant="primary" magnetic onClick={(e) => choose(crop.id, e.currentTarget)}>
              {t('choose', { ns: 'common' })}
            </Button>
          ) : (
            <Badge tone="warn">{t('planner.outOfSeason')}</Badge>
          )}
        </div>
        {scored && <ScoreBar value={scored.score} tone={chosen ? 'accent' : 'primary'} />}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [t('duration', { ns: 'common' }), `${crop.d} ${t('days', { ns: 'common' })}`],
            [t('yield', { ns: 'common' }), `${num(crop.y, 1)} ${t('qpa', { ns: 'common' })}`],
            [t('income', { ns: 'common' }), money(crop.y * crop.p * farm.areaAcres)],
            [t('msp', { ns: 'common' }), crop.msp ? money(crop.msp) : t('noMsp', { ns: 'common' })],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-fg-muted">{k}</dt>
              <dd className="num text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-fg-muted">{t('planner.incomeNote')}</p>
      </m.section>

      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        {scored && (
          <Card title={t('planner.why')}>
            <ul className="flex flex-col gap-2">
              {scored.reasons.map((r) => (
                <li key={r.key} className="flex items-start gap-2">
                  <Icon
                    name={r.ok ? 'check' : 'alert'}
                    size={18}
                    className={`mt-0.5 shrink-0 ${r.ok ? 'text-good' : 'text-warn'}`}
                  />
                  <span>{reason(r)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title={t('planner.needs')}>
          <ul className="flex flex-col gap-2 text-fg">
            <li>{t('planner.seasonsLine', { list: list(crop.s, ref.data.seasons) })}</li>
            <li>{t('planner.soilsLine', { list: list(crop.soil, ref.data.soils) })}</li>
            <li>{t('planner.phRange', { lo: crop.ph[0], hi: crop.ph[1] })}</li>
            <li>{t('planner.waterRange', { lo: crop.w[0], hi: crop.w[1] })}</li>
            <li>{t('planner.tempRange', { lo: crop.t[0], hi: crop.t[1] })}</li>
            <li>{t('planner.npkLine', { n: crop.npk[0], p: crop.npk[1], k: crop.npk[2] })}</li>
            {!!crop.leg && <li className="font-semibold text-good">{t('planner.legume')}</li>}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/app/nutrients?crop=${crop.id}`} className="btn-secondary">
              {t('nav2.nutrients', { ns: 'common' })}
            </Link>
            <Link to={`/app/market?crop=${crop.id}`} className="btn-secondary">
              {t('nav2.market', { ns: 'common' })}
            </Link>
          </div>
        </Card>
      </m.div>
    </div>
  );
}
