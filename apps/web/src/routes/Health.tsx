// Crop health: big tactile symptom chips (the ones that match the likely pest light up one by one), a leaf
// photo with a scanning beam while it is checked, and result cards that flip in.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { shrinkPhoto } from '../lib/image';
import { prefersReducedMotion } from '../lib/effects';
import { useAnalyseLeaf, useDiagnose, useReference } from '../lib/queries';
import type { HealthCheckDto } from '../lib/api-types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/signature/PrimaryAction';
import {
  Badge,
  Callout,
  Card,
  Empty,
  Field,
  PageHeader,
  PageSkeleton,
  ScoreBar,
  inputClass,
} from '../components/ui';

const REGION_COLOUR = { yellow: 'var(--warn)', brown: 'var(--bad)', white: 'var(--info)' } as const;
// Full class names for Tailwind's scanner.
const BRACKETS = [
  'left-2 top-2 border-l-4 border-t-4',
  'right-2 top-2 border-r-4 border-t-4',
  'bottom-2 left-2 border-b-4 border-l-4',
  'bottom-2 right-2 border-b-4 border-r-4',
];

export function Health() {
  const { t, label } = useFmt();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const diagnose = useDiagnose();
  const analyse = useAnalyseLeaf();
  const [crop, setCrop] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [check, setCheck] = useState<HealthCheckDto | null>(null);
  const results = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!crop && farm) setCrop(farm.crop ?? '');
  }, [farm, crop]);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const top = diagnose.data?.matches[0];
  const topPest = ref.data?.pests.find((p) => p.id === top?.pestId);
  // Chips the likely pest explains, in the order they were picked, so they light up in turn.
  const matched = topPest ? symptoms.filter((s) => topPest.s.includes(s)) : [];
  useSay(
    topPest
      ? `${label(topPest.n)}. ${t('organicT', { ns: 'common' })}: ${label(topPest.o)} ${t('chemT', { ns: 'common' })}: ${label(topPest.ch)}`
      : t('pest_lead', { ns: 'common' }),
  );

  if (!ref.data || !farm) return <PageSkeleton cards={2} />;
  const cropId = crop || ref.data.crops[0]!.id;

  const toggle = (s: string) =>
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const run = (list = symptoms) => {
    if (!list.length) return;
    diagnose.mutate(
      { crop: cropId, symptoms: list, farmId: farm.id },
      {
        onSuccess: () =>
          setTimeout(
            () =>
              results.current?.scrollIntoView({
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                block: 'start',
              }),
            50,
          ),
      },
    );
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setCheck(null);
    setPhoto(URL.createObjectURL(file));
    const blob = await shrinkPhoto(file);
    analyse.mutate({ file: blob, crop: cropId, farmId: farm.id }, { onSuccess: setCheck });
  };

  const scanning = analyse.isPending;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('pest_lead', { ns: 'common' })} sub={t('pest_sub', { ns: 'common' })} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={t('signs', { ns: 'common' })} sub={t('health.pick')}>
          <div className="mb-4 max-w-xs">
            <Field label={t('crop', { ns: 'common' })} htmlFor="h-crop">
              <select
                id="h-crop"
                value={cropId}
                onChange={(e) => setCrop(e.target.value)}
                className={inputClass}
              >
                {ref.data.crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {label(c.n)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {topPest && matched.length > 0 && (
            <p className="mb-2 text-sm font-semibold text-fg-muted">
              {t('health.matched', { pest: label(topPest.n) })}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            {ref.data.symptoms.map((s) => {
              const on = symptoms.includes(s.id);
              const order = matched.indexOf(s.id);
              return (
                <m.button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  whileTap={{ scale: 0.92, y: 2 }}
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  onClick={() => toggle(s.id)}
                  className={`relative inline-flex min-h-14 items-center gap-2 rounded-2xl border-2 px-4 text-base font-semibold shadow-1 transition-colors duration-1 ${on ? 'border-primary bg-primary text-primary-ink shadow-2' : 'border-line bg-surface text-fg hover:border-primary'}`}
                >
                  {on && <Icon name="check" size={18} />}
                  {label(s.labels)}
                  {/* A matched chip lights up: a glowing accent ring, one chip after another. */}
                  {order >= 0 && (
                    <m.span
                      key={`${topPest?.id ?? ''}-${s.id}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-1.5 rounded-[1.25rem] border-[3px] border-accent shadow-[0_0_18px_var(--accent)]"
                      initial={{ opacity: 0, scale: 1.15 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + order * 0.28, type: 'spring', stiffness: 320, damping: 18 }}
                    />
                  )}
                </m.button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <PrimaryAction onClick={() => run()} disabled={!symptoms.length} busy={diagnose.isPending}>
              {t('diagnose', { ns: 'common' })}
            </PrimaryAction>
            <Button variant="quiet" onClick={() => setSymptoms([])} disabled={!symptoms.length}>
              {t('clear', { ns: 'common' })}
            </Button>
          </div>
          {!symptoms.length && diagnose.isIdle && (
            <p className="mt-3 text-sm text-fg-muted">{t('noSigns', { ns: 'common' })}</p>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title={t('photo', { ns: 'common' })}
          sub={t('photoHint', { ns: 'common' })}
          actions={<Badge tone="info">{t('health.notModel')}</Badge>}
        >
          <label className="group flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-2 p-4 text-center transition-colors duration-2 hover:border-primary focus-within:outline focus-within:outline-[3px] focus-within:outline-focus">
            {/* A leaf in a camera frame (original drawing). */}
            <svg
              width="64"
              height="56"
              viewBox="0 0 64 56"
              aria-hidden="true"
              className="transition-transform duration-2 group-hover:-translate-y-0.5"
            >
              <path
                d="M6 14V8a4 4 0 0 1 4-4h6M48 4h6a4 4 0 0 1 4 4v6M58 42v6a4 4 0 0 1-4 4h-6M16 52h-6a4 4 0 0 1-4-4v-6"
                stroke="var(--text-muted)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path d="M18 40C18 22 32 12 48 12c0 18-12 30-30 28Z" fill="var(--leaf-500)" />
              <path
                d="M20 39 44 16M28 31l-1-8M34 25l6 1"
                stroke="var(--leaf-100)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-semibold">{t('health.upload')}</span>
            <span className="text-sm text-fg-muted">{t('health.dropTitle')}</span>
            <span className="text-sm text-fg-muted">{t('health.take')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              capture="environment"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>

          {photo && (
            <div className="mt-4 rounded-md bg-surface-2">
              <div className="relative mx-auto w-fit overflow-hidden rounded-md">
                <img src={photo} alt="" className="block max-h-80 max-w-full" />
                <AnimatePresence>
                  {scanning && (
                    <m.div
                      key="scan"
                      className="pointer-events-none absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="absolute inset-0 bg-[linear-gradient(transparent_95%,color-mix(in_srgb,var(--accent)_30%,transparent)_95%)] bg-[length:100%_16px]" />
                      {/* Corner brackets frame the leaf being read. */}
                      {BRACKETS.map((c) => (
                        <span key={c} className={`absolute h-6 w-6 rounded-sm border-accent ${c}`} />
                      ))}
                      {/* The beam: a bright line trailing a soft glow. */}
                      <m.div
                        className="absolute inset-x-0 h-16 -translate-y-full bg-gradient-to-b from-transparent to-accent/40"
                        initial={{ top: '0%' }}
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-accent shadow-[0_0_16px_4px_var(--accent)]" />
                      </m.div>
                    </m.div>
                  )}
                </AnimatePresence>
                {check?.regions.map((r, i) => (
                  // Regions are fractions of the image; this box is exactly the image's size, so they line up.
                  <m.span
                    key={i}
                    aria-hidden="true"
                    initial={{ opacity: 0, scale: 1.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * i, type: 'spring', stiffness: 300, damping: 20 }}
                    className="absolute rounded-sm border-2"
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                      borderColor: REGION_COLOUR[r.kind],
                      background: `color-mix(in srgb, ${REGION_COLOUR[r.kind]} 18%, transparent)`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {scanning && (
            <p role="status" className="mt-3 text-sm font-semibold">
              {t('health.scanning')}
            </p>
          )}
          {analyse.isError && (
            <div className="mt-3">
              <Callout tone="bad" title={analyse.error.message} />
            </div>
          )}
          {check && (
            <div className="mt-4 flex flex-col gap-3">
              {(
                [
                  ['green', 'green', 'var(--series-1)'],
                  ['yellow', 'yellowC', 'var(--series-3)'],
                  ['brown', 'brown', 'var(--soil-500)'],
                  ['white', 'white', 'var(--monsoon-300)'],
                ] as const
              ).map(([k, lk, col]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-sm">
                  <span>{t(lk, { ns: 'common' })}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <m.span
                      className="block h-full rounded-full"
                      style={{ background: col }}
                      initial={{ width: 0 }}
                      animate={{ width: `${check.colours[k]}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </span>
                  <b className="num text-right">{Math.round(check.colours[k])}%</b>
                </div>
              ))}
              {check.findings.map((k) => (
                <p key={k} className="font-semibold">
                  {t(k, { ns: 'advice' })}
                </p>
              ))}
              {check.regions.length > 0 && <p className="text-sm text-fg-muted">{t('health.found')}</p>}
              {check.symptoms.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const next = [...new Set([...symptoms, ...check.symptoms])];
                    setSymptoms(next);
                    run(next);
                  }}
                >
                  <Icon name="plus" size={16} />
                  {t('addSigns', { ns: 'common' })}
                </Button>
              )}
              <p className="text-xs text-fg-muted">{t('photoNote', { ns: 'common' })}</p>
            </div>
          )}
        </Card>
      </div>

      <div ref={results} className="scroll-mt-24">
        {diagnose.data && (
          <Card title={t('results', { ns: 'common' })}>
            {!diagnose.data.matches.length ? (
              <Empty>{t('noMatch', { ns: 'common' })}</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {diagnose.data.matches.map((mt, i) => {
                  const p = ref.data!.pests.find((x) => x.id === mt.pestId)!;
                  return (
                    // Cards flip in like turned-over field notes, one after another.
                    <m.article
                      key={mt.pestId}
                      initial={{ opacity: 0, rotateY: -80 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      transition={{ delay: 0.1 + i * 0.15, type: 'spring', stiffness: 140, damping: 18 }}
                      style={{ transformPerspective: 900, transformOrigin: 'left center' }}
                      className={`flex flex-col gap-3 rounded-xl border-2 bg-surface p-4 shadow-1 ${i === 0 ? 'border-primary shadow-2' : 'border-line'}`}
                    >
                      <div>
                        <p className="text-sm text-fg-muted">
                          {i === 0 ? t('likely', { ns: 'common' }) : t('alsoP', { ns: 'common' })}
                        </p>
                        <h3 className="text-lg font-semibold">{label(p.n)}</h3>
                      </div>
                      <ScoreBar value={mt.score} tone={i === 0 ? 'primary' : 'accent'} />
                      <dl className="flex flex-col gap-2 text-sm">
                        <div>
                          <dt className="font-semibold text-good">{t('organicT', { ns: 'common' })}</dt>
                          <dd>{label(p.o)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-warn">{t('chemT', { ns: 'common' })}</dt>
                          <dd>{label(p.ch)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-info">{t('prevT', { ns: 'common' })}</dt>
                          <dd>{label(p.pv)}</dd>
                        </div>
                      </dl>
                    </m.article>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-3">
              <Callout tone="warn">{t('safety', { ns: 'common' })}</Callout>
              <Link to={`/app/desk?ask=1&crop=${cropId}`} className="btn-secondary self-start">
                <Icon name="desk" size={18} />
                {t('askExpert', { ns: 'common' })}
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
