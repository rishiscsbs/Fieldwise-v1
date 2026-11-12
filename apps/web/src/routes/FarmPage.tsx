import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { lvlK, lvlN, lvlP, seasonFor, type FarmInput } from '@fieldwise/shared';
import { useSay } from '../stores/page';
import { useUi } from '../stores/ui';
import { toast } from '../stores/toast';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { ApiError } from '../lib/api';
import { burst } from '../lib/effects';
import {
  useAddSoilTest,
  useCreateFarm,
  useDeleteFarm,
  useFarm,
  useRecommendations,
  useReference,
  useUpdateFarm,
} from '../lib/queries';
import { ChartFrame, DataTable, SERIES } from '../charts/frame';
import { Lines } from '../charts/charts';
import { Button } from '../components/Button';
import {
  Callout,
  Card,
  ErrorState,
  Field,
  LevelBadge,
  PageHeader,
  PageSkeleton,
  inputClass,
} from '../components/ui';

type SoilForm = { testedAt: string; ph: number; n: number; p: number; k: number; source: 'shc' | 'self' };
const today = () => new Date().toISOString().slice(0, 10);

export function FarmPage({ create = false }: { create?: boolean }) {
  const { t, label, num, date } = useFmt();
  const navigate = useNavigate();
  const setFarmId = useUi((s) => s.setFarmId);
  const { farm: active } = useActiveFarm();
  const ref = useReference();
  const detail = useFarm(create ? undefined : active?.id);
  const recs = useRecommendations(create ? undefined : active?.id);
  const update = useUpdateFarm(active?.id ?? '');
  const createFarm = useCreateFarm();
  const del = useDeleteFarm();
  const addTest = useAddSoilTest(active?.id ?? '');

  const [form, setForm] = useState<FarmInput | null>(null);
  const [soil, setSoil] = useState<SoilForm>({
    testedAt: today(),
    ph: 7,
    n: 280,
    p: 15,
    k: 200,
    source: 'shc',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (create) {
      const d = ref.data?.districts[0];
      setForm({
        name: t('farm.new'),
        districtId: active?.districtId ?? d?.id ?? 'nagpur',
        village: '',
        soil: 'black',
        irrigation: 'partial',
        areaAcres: 1,
        season: seasonFor(new Date()),
        crop: null,
      });
    } else if (detail.data) {
      const f = detail.data;
      setForm({
        name: f.name,
        districtId: f.districtId,
        village: f.village,
        soil: f.soil,
        irrigation: f.irrigation as FarmInput['irrigation'],
        areaAcres: f.areaAcres,
        season: f.season,
        crop: f.crop,
        lat: f.lat,
        lon: f.lon,
      });
      if (f.latestSoilTest)
        setSoil((s) => ({
          ...s,
          ph: f.latestSoilTest!.ph,
          n: f.latestSoilTest!.n,
          p: f.latestSoilTest!.p,
          k: f.latestSoilTest!.k,
        }));
    }
  }, [create, detail.data, ref.data, active?.districtId, t]);

  useSay(t('farm_sub', { ns: 'common' }));

  if (detail.isError) return <ErrorState onRetry={() => void detail.refetch()} />;
  if (!ref.data || !form || (!create && !detail.data)) return <PageSkeleton cards={2} />;

  const set = <K extends keyof FarmInput>(k: K, v: FarmInput[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : t('toast.error'));

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const btn = e.currentTarget.querySelector('button[type=submit]');
    try {
      if (create) {
        const f = await createFarm.mutateAsync({
          ...form,
          soilTest: { testedAt: soil.testedAt, ph: soil.ph, n: soil.n, p: soil.p, k: soil.k },
        });
        setFarmId(f.id);
        void burst(btn);
        toast({ tone: 'good', title: t('farm.saved') });
        navigate('/app');
      } else {
        await update.mutateAsync(form);
        toast({ tone: 'good', title: t('saved', { ns: 'common' }) });
      }
    } catch (err) {
      fail(err);
    }
  };

  const saveTest = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await addTest.mutateAsync(soil);
      toast({ tone: 'good', title: t('farm.testSaved') });
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    if (!active || !window.confirm(t('farm.deleteConfirm'))) return;
    await del.mutateAsync(active.id);
    setFarmId(null);
    toast({ tone: 'info', title: t('farm.deleted') });
    navigate('/app');
  };

  const tests = [...(detail.data?.soilTests ?? [])].reverse(); // oldest first for charts
  const levels = { n: lvlN(soil.n), p: lvlP(soil.p), k: lvlK(soil.k) };
  const numberField = (
    id: keyof Pick<SoilForm, 'ph' | 'n' | 'p' | 'k'>,
    labelKey: string,
    step: number,
    level?: 'low' | 'med' | 'high',
  ) => (
    <Field label={t(labelKey, { ns: 'common' })} htmlFor={`st-${id}`}>
      <div className="flex items-center gap-2">
        <input
          id={`st-${id}`}
          type="number"
          step={step}
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={create ? t('farm.new') : t('pt_profile', { ns: 'common' })}
        sub={t('ps_profile', { ns: 'common' })}
      />
      {error && <Callout tone="bad" title={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t('profile', { ns: 'common' })}
          sub={!create && recs.data ? t('farm.water', { mm: num(recs.data.water) }) : undefined}
        >
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label={t('onboard.farmName')} htmlFor="f-name">
              <input
                id="f-name"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('onboard.village')} htmlFor="f-village">
              <input
                id="f-village"
                value={form.village}
                onChange={(e) => set('village', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('district', { ns: 'common' })} htmlFor="f-district">
              <select
                id="f-district"
                value={form.districtId}
                onChange={(e) => set('districtId', e.target.value)}
                className={inputClass}
              >
                {ref.data.districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {label(d.labels)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('season', { ns: 'common' })} htmlFor="f-season">
              <select
                id="f-season"
                value={form.season}
                onChange={(e) => set('season', e.target.value as FarmInput['season'])}
                className={inputClass}
              >
                {ref.data.seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s.labels)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('soil', { ns: 'common' })} htmlFor="f-soil">
              <select
                id="f-soil"
                value={form.soil}
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
            <Field label={t('irrigation', { ns: 'common' })} htmlFor="f-irr">
              <select
                id="f-irr"
                value={form.irrigation}
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
            <Field label={t('area', { ns: 'common' })} htmlFor="f-area">
              <input
                id="f-area"
                type="number"
                min={0.25}
                step={0.25}
                required
                value={form.areaAcres}
                onChange={(e) => set('areaAcres', Number(e.target.value))}
                className={`${inputClass} num`}
              />
            </Field>
            {create && (
              <div className="sm:col-span-2">
                <p className="mb-3 font-semibold">{t('shc', { ns: 'common' })}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {numberField('ph', 'ph', 0.1)}
                  {numberField('n', 'N', 1, levels.n)}
                  {numberField('p', 'P', 1, levels.p)}
                  {numberField('k', 'K', 1, levels.k)}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="submit"
                variant="primary"
                magnetic
                busy={update.isPending || createFarm.isPending}
              >
                {create ? t('farm.create') : t('saveProfile', { ns: 'common' })}
              </Button>
              {!create && (
                <Button variant="quiet" onClick={() => navigate('/app/planner')}>
                  {t('viewPlan', { ns: 'common' })}
                </Button>
              )}
            </div>
          </form>
        </Card>

        {!create && (
          <Card
            title={t('shc', { ns: 'common' })}
            sub={
              detail.data?.latestSoilTest
                ? date(detail.data.latestSoilTest.testedAt, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : t('defaults')
            }
          >
            <form onSubmit={saveTest} className="grid gap-4 sm:grid-cols-2">
              <Field label={t('farm.testedAt')} htmlFor="st-date">
                <input
                  id="st-date"
                  type="date"
                  max={today()}
                  required
                  value={soil.testedAt}
                  onChange={(e) => setSoil((s) => ({ ...s, testedAt: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label={t('farm.source')} htmlFor="st-src">
                <select
                  id="st-src"
                  value={soil.source}
                  onChange={(e) => setSoil((s) => ({ ...s, source: e.target.value as SoilForm['source'] }))}
                  className={inputClass}
                >
                  <option value="shc">{t('farm.sourceShc')}</option>
                  <option value="self">{t('farm.sourceSelf')}</option>
                </select>
              </Field>
              {numberField('ph', 'ph', 0.1)}
              {numberField('n', 'N', 1, levels.n)}
              {numberField('p', 'P', 1, levels.p)}
              {numberField('k', 'K', 1, levels.k)}
              <div className="sm:col-span-2">
                <Button type="submit" variant="secondary" busy={addTest.isPending}>
                  {t('farm.addTest')}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {!create && tests.length > 0 && (
        <Card title={t('farm.history')} sub={t('farm.historySub')}>
          <ChartFrame
            label={t('farm.history')}
            chart={
              // One small chart per nutrient: their scales differ too much to share an axis.
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['ph', 'ph', SERIES[1]],
                    ['n', 'N', SERIES[0]],
                    ['p', 'P', SERIES[2]],
                    ['k', 'K', SERIES[3]],
                  ] as const
                ).map(([k, lk, color]) => (
                  <div key={k} className="min-w-0">
                    <p className="text-sm font-semibold">{t(lk, { ns: 'common' })}</p>
                    <Lines
                      height={150}
                      area
                      xLabels={tests.map((x) => date(x.testedAt, { month: 'short', year: 'numeric' }))}
                      format={(v) => num(v, k === 'ph' ? 1 : 0)}
                      series={[{ label: t(lk, { ns: 'common' }), values: tests.map((x) => x[k]), color }]}
                    />
                  </div>
                ))}
              </div>
            }
            table={
              <DataTable
                head={[t('farm.testedAt'), t('ph', { ns: 'common' }), 'N', 'P', 'K']}
                numeric={[1, 2, 3, 4]}
                rows={tests.map((x) => [
                  date(x.testedAt, { day: 'numeric', month: 'short', year: 'numeric' }),
                  num(x.ph, 1),
                  num(x.n),
                  num(x.p),
                  num(x.k),
                ])}
              />
            }
          />
        </Card>
      )}

      {!create && (
        <div>
          <Button variant="quiet" className="text-bad" onClick={() => void remove()}>
            {t('farm.delete')}
          </Button>
        </div>
      )}
    </div>
  );
}
