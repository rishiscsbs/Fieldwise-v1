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
          <div className="flex flex-wrap gap-2">
            {ref.data.symptoms.map((s) => {
              const on = symptoms.includes(s.id);
              return (
                <m.button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => toggle(s.id)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-1 ${on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-fg hover:bg-surface-2'}`}
                >
                  {on && <Icon name="check" size={14} />}
                  {label(s.labels)}
                </m.button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="primary"
              magnetic
              onClick={() => run()}
              disabled={!symptoms.length}
              busy={diagnose.isPending}
            >
              {t('diagnose', { ns: 'common' })}
            </Button>
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
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line p-4 text-center hover:bg-surface-2 focus-within:outline focus-within:outline-2 focus-within:outline-focus">
            <Icon name="camera" size={28} className="text-fg-muted" />
            <span className="font-semibold">{t('health.upload')}</span>
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
                      <m.div
                        className="absolute inset-x-0 h-1 bg-accent shadow-[0_0_16px_4px_var(--accent)]"
                        initial={{ top: '0%' }}
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      />
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
                    <m.article
                      key={mt.pestId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`flex flex-col gap-3 rounded-md border p-4 ${i === 0 ? 'border-primary' : 'border-line'}`}
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
