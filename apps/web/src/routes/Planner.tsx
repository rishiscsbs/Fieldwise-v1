// Crop planner: a season wheel at the top (it changes the field's season, and the colours sweep with it), then
// the in-season crops as a ranked list with growing-plant score bars or as a Flex Carousel gallery.
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import type { Season } from '@fieldwise/shared';
import { useSay } from '../stores/page';
import { useUi } from '../stores/ui';
import { toast } from '../stores/toast';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useChooseCrop } from '../lib/choose';
import { useRecommendations, useReference, useUpdateFarm } from '../lib/queries';
import { useMotionMode } from '../lib/motion-mode';
import { sweepFromHere } from '../lib/season';
import { cropImage } from '../lib/crop-posters';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { GrowBar } from '../components/GrowBar';
import { WheelPicker } from '../components/signature/WheelPicker';
import { CropStrip } from '../components/signature/CropStrip';
import { PrimaryAction } from '../components/signature/PrimaryAction';
import { Badge, Callout, Card, ErrorState, PageHeader, PageSkeleton, Skeleton } from '../components/ui';

// three.js only loads if someone opens the 3D view.
const Suitability3D = lazy(() => import('../landing/Suitability3D'));

const SEASONS: Season[] = ['kharif', 'rabi', 'zaid'];
type View = 'list' | 'gallery';

export function Planner() {
  const { t, label, short, money, num, reason } = useFmt();
  const navigate = useNavigate();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const recs = useRecommendations(farm?.id);
  const choose = useChooseCrop(ref.data);
  const update = useUpdateFarm(farm?.id ?? '');
  const chosen = farm?.crop ?? recs.data?.activeCrop;
  const season = ref.data?.seasons.find((s) => s.id === farm?.season);
  const first = recs.data?.list[0];
  const firstCrop = ref.data?.crops.find((c) => c.id === first?.cropId);
  const mode = useMotionMode();
  const [show3d, setShow3d] = useState(false);
  const [view, setView] = useState<View>('list');

  useSay(
    firstCrop
      ? `${t('crops_lead', { ns: 'common', c: label(firstCrop.n), s: short(season?.labels) })}. ${t('crops_sub', { ns: 'common' })}`
      : undefined,
  );

  if (recs.isError) return <ErrorState onRetry={() => void recs.refetch()} />;
  if (!farm || !ref.data || !recs.data || !firstCrop) return <PageSkeleton cards={6} />;

  const crop = (id: string) => ref.data!.crops.find((c) => c.id === id)!;
  const out = recs.data.out.map(crop);
  const bestUnchosen = recs.data.list.find((x) => x.cropId !== chosen)?.cropId;

  /** The wheel plans a different season for this field: the farm is updated and the palette sweeps over. */
  const changeSeason = (s: Season, from: Element | null) => {
    sweepFromHere(from);
    useUi.getState().setSeason(null);
    update.mutate({ season: s });
    toast({ tone: 'good', title: t('planner.seasonSaved', { s: t(`season.${s}`) }) });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_15rem]">
        <PageHeader
          title={t('crops_lead', { ns: 'common', c: label(firstCrop.n), s: short(season?.labels) })}
          sub={t('crops_sub', { ns: 'common' })}
        />
        <WheelPicker
          label={t('planner.seasonPick')}
          options={SEASONS.map((s) => ({ value: s, label: t(`season.${s}`) }))}
          value={farm.season}
          onChange={changeSeason}
          settle={500}
          height={150}
          className="mb-6"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label={t('planner.viewAs')}
          className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-1"
        >
          {(['list', 'gallery'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={`relative min-h-10 rounded-md px-4 font-semibold transition-colors duration-1 ${view === v ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
            >
              {view === v && (
                <m.span
                  layoutId="planner-view"
                  className="absolute inset-0 rounded-md bg-accent-soft"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{t(`planner.${v}`)}</span>
            </button>
          ))}
        </div>
        {mode === 'full' && (
          <Button variant="secondary" aria-expanded={show3d} onClick={() => setShow3d((v) => !v)}>
            <Icon name="chart" size={18} />
            {show3d ? t('planner.hide3d') : t('planner.view3d')}
          </Button>
        )}
      </div>

      {recs.data.usingDefaults && <Callout tone="info" title={t('defaults')} />}
      {show3d && mode === 'full' && (
        <Suspense fallback={<Skeleton className="h-80 w-full" />}>
          <Suitability3D
            hint={t('planner.hint3d')}
            bars={recs.data.list.map((x) => ({
              id: x.cropId,
              label: label(crop(x.cropId).n),
              emoji: crop(x.cropId).e,
              score: x.score,
              active: x.cropId === chosen,
            }))}
          />
        </Suspense>
      )}

      {view === 'gallery' ? (
        <CropStrip
          label={t('planner.galleryLabel')}
          className="-mx-4 h-[400px] sm:-mx-6 sm:h-[460px]"
          items={recs.data.list.map((x) => {
            const c = crop(x.cropId);
            return {
              src: cropImage(c),
              alt: label(c.n),
              title: label(c.n),
              subtitle: t('planner.scoreLine', { s: x.score }),
            };
          })}
          onSelect={(i) => {
            const x = recs.data!.list[i];
            if (x) navigate(`/app/planner/${x.cropId}`);
          }}
        />
      ) : (
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
                <GrowBar
                  value={x.score}
                  tone={isChosen ? 'accent' : 'primary'}
                  delay={Math.min(i, 8) * 0.06}
                />
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
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  {/* One Specular button per screen: the best crop not yet chosen gets it, the rest stay plain. */}
                  {!isChosen &&
                    (x.cropId === bestUnchosen ? (
                      <PrimaryAction onClick={(e) => choose(x.cropId, e.currentTarget)}>
                        {t('choose', { ns: 'common' })}
                      </PrimaryAction>
                    ) : (
                      <Button variant="primary" onClick={(e) => choose(x.cropId, e.currentTarget)}>
                        {t('choose', { ns: 'common' })}
                      </Button>
                    ))}
                  <Link to={`/app/planner/${x.cropId}`} className="btn-quiet">
                    {t('planner.details')}
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </m.li>
            );
          })}
        </ol>
      )}

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
