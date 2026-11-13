// First run for a new farmer, as a short playful flow beside a growing plant: "You" (name) plants the seed,
// "Your field" keeps it in the ground, reaching the optional "Soil card" makes it sprout, and finishing grows it into a
// full plant in grain before the app opens. Farmers who already have a field only see the first step.
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { lvlK, lvlN, lvlP, seasonFor, type FarmInput } from '@fieldwise/shared';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';
import { useCreateFarm, useFarms, useReference, useUpdateMe } from '../lib/queries';
import { useFmt } from '../lib/format';
import { ApiError } from '../lib/api';
import { burst, haptic, prefersReducedMotion } from '../lib/effects';
import { PublicHeader } from '../components/PublicHeader';
import { Button } from '../components/Button';
import { Growth, type GrowthStage } from '../components/Growth';
import { PrimaryAction } from '../components/signature/PrimaryAction';
import { Callout, Field, LevelBadge, PageSkeleton, inputClass } from '../components/ui';

type Step = 'you' | 'field' | 'soil';
type Soil = { ph: number; n: number; p: number; k: number };

export function Welcome() {
  const { t } = useTranslation();
  const { label } = useFmt();
  const user = useAuth((s) => s.user)!;
  const ref = useReference();
  const farms = useFarms();
  const updateMe = useUpdateMe();
  const createFarm = useCreateFarm();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [farm, setFarm] = useState<FarmInput>({
    name: t('onboard.farmNameDefault'),
    districtId: user.districtId ?? 'nagpur',
    village: '',
    soil: 'black',
    irrigation: 'partial',
    areaAcres: 2,
    season: seasonFor(new Date()),
    crop: null,
  });
  const [soil, setSoil] = useState<Soil>({ ph: 7, n: 280, p: 15, k: 200 });
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ref.isLoading || farms.isLoading || !ref.data) return <PageSkeleton cards={1} />;
  const hasFarm = !!farms.data?.length;
  const steps: Step[] = hasFarm ? ['you'] : ['you', 'field', 'soil'];
  const step = steps[index]!;
  const last = index === steps.length - 1;
  const busy = updateMe.isPending || createFarm.isPending;

  // Seed when the farmer has a name, a sprout at the soil card, a full plant when done.
  const stage: GrowthStage = done ? 3 : step === 'soil' ? 2 : name.trim() ? 1 : 0;

  const finish = async (withSoil: boolean, from: Element | null) => {
    setError(null);
    try {
      await updateMe.mutateAsync({ name, districtId: farm.districtId });
      if (!hasFarm)
        await createFarm.mutateAsync(
          withSoil
            ? { ...farm, soilTest: { testedAt: new Date().toISOString().slice(0, 10), ...soil } }
            : farm,
        );
      setDone(true);
      haptic([10, 50, 20]);
      void burst(from);
      // Let the plant finish growing before the app opens (straight away when motion is reduced).
      const calm = prefersReducedMotion() || useUi.getState().lite;
      setTimeout(() => navigate('/app', { replace: true }), calm ? 0 : 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.error'));
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!last) return setIndex((i) => i + 1);
    // Finishing on the soil step saves the card as shown; Skip leaves it out.
    void finish(true, e.currentTarget.querySelector('button[type=submit]'));
  };

  const set = <K extends keyof FarmInput>(k: K, v: FarmInput[K]) => setFarm((f) => ({ ...f, [k]: v }));
  const district = ref.data.districts.find((d) => d.id === farm.districtId);
  const levels = { n: lvlN(soil.n), p: lvlP(soil.p), k: lvlK(soil.k) };
  const soilField = (id: keyof Soil, labelKey: string, stepBy: number, level?: 'low' | 'med' | 'high') => (
    <Field label={t(labelKey, { ns: 'common' })} htmlFor={`w-${id}`}>
      <div className="flex items-center gap-2">
        <input
          id={`w-${id}`}
          type="number"
          step={stepBy}
          min={0}
          required
          value={soil[id]}
          onChange={(e) => setSoil((s) => ({ ...s, [id]: Number(e.target.value) }))}
          className={`${inputClass} num`}
        />
        {level && <LevelBadge level={level} />}
      </div>
    </Field>
  );

  return (
    <>
      <div className="field-bg" aria-hidden="true" />
      <PublicHeader />
      <main
        id="main"
        className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_1.35fr] md:items-center md:py-14"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Smaller on phones so the form stays in view. */}
          <div className="w-32 sm:w-48 md:w-64">
            <Growth stage={stage} />
          </div>
          <AnimatePresence mode="wait">
            {done && (
              <m.p
                key="done"
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-display text-2xl"
              >
                {t('onboard.growing')}
              </m.p>
            )}
          </AnimatePresence>
          {steps.length > 1 && (
            <ol
              className="flex flex-wrap justify-center gap-2"
              aria-label={t('onboard.stepOf', { n: index + 1, total: steps.length })}
            >
              {steps.map((s, i) => (
                <li
                  key={s}
                  aria-current={i === index ? 'step' : undefined}
                  className={`badge ${i === index ? 'bg-primary text-primary-ink' : i < index ? 'bg-accent-soft text-fg' : 'bg-surface-2 text-fg-muted'}`}
                >
                  <span className="num">{i + 1}</span> {t(`onboard.steps.${s}`)}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form onSubmit={submit} className="glass flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <h1 className="font-display text-3xl">{t('onboard.title')}</h1>
            <p className="text-fg-muted">{step === 'soil' ? t('onboard.soilLead') : t('onboard.lead')}</p>
          </div>
          {error && <Callout tone="bad" title={error} />}

          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              {step === 'you' && (
                <Field label={t('onboard.name')} htmlFor="w-name">
                  <input
                    id="w-name"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    autoComplete="name"
                  />
                </Field>
              )}
              {step === 'field' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('onboard.farmName')} htmlFor="w-farm">
                    <input
                      id="w-farm"
                      required
                      value={farm.name}
                      onChange={(e) => set('name', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t('onboard.village')} htmlFor="w-village">
                    <input
                      id="w-village"
                      value={farm.village}
                      onChange={(e) => set('village', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t('district', { ns: 'common' })} htmlFor="w-district">
                    <select
                      id="w-district"
                      value={farm.districtId}
                      onChange={(e) => {
                        const d = ref.data!.districts.find((x) => x.id === e.target.value);
                        setFarm((f) => ({ ...f, districtId: e.target.value, soil: d?.soil ?? f.soil }));
                      }}
                      className={inputClass}
                    >
                      {ref.data.districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {label(d.labels)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t('soil', { ns: 'common' })}
                    htmlFor="w-soil"
                    hint={
                      district
                        ? `${label(district.labels).split(',')[0]}: ${label(ref.data.soils.find((s) => s.id === district.soil)?.labels)}`
                        : undefined
                    }
                  >
                    <select
                      id="w-soil"
                      value={farm.soil}
                      onChange={(e) => set('soil', e.target.value)}
                      className={inputClass}
                    >
                      {ref.data.soils.map((s) => (
                        <option key={s.id} value={s.id}>
                          {label(s.labels)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('irrigation', { ns: 'common' })} htmlFor="w-irr">
                    <select
                      id="w-irr"
                      value={farm.irrigation}
                      onChange={(e) => set('irrigation', e.target.value as FarmInput['irrigation'])}
                      className={inputClass}
                    >
                      {ref.data.irrigation.map((i) => (
                        <option key={i.id} value={i.id}>
                          {label(i.labels)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('area', { ns: 'common' })} htmlFor="w-area">
                    <input
                      id="w-area"
                      type="number"
                      min={0.25}
                      step={0.25}
                      required
                      value={farm.areaAcres}
                      onChange={(e) => set('areaAcres', Number(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
              {step === 'soil' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {soilField('ph', 'ph', 0.1)}
                  {soilField('n', 'N', 1, levels.n)}
                  {soilField('p', 'P', 1, levels.p)}
                  {soilField('k', 'K', 1, levels.k)}
                </div>
              )}
            </m.div>
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-2">
            {last ? (
              <PrimaryAction type="submit" busy={busy || done} size="lg">
                {t('onboard.save')}
              </PrimaryAction>
            ) : (
              <Button type="submit" variant="primary">
                {t('onboard.next')}
              </Button>
            )}
            {index > 0 && !done && (
              <Button variant="quiet" onClick={() => setIndex((i) => i - 1)}>
                {t('onboard.back')}
              </Button>
            )}
            {step === 'soil' && !done && (
              <Button variant="quiet" disabled={busy} onClick={(e) => void finish(false, e.currentTarget)}>
                {t('onboard.skip')}
              </Button>
            )}
          </div>
        </form>
      </main>
    </>
  );
}
