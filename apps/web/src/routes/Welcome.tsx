import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { seasonFor, type FarmInput } from '@fieldwise/shared';
import { useAuth } from '../stores/auth';
import { useCreateFarm, useFarms, useReference, useUpdateMe } from '../lib/queries';
import { useFmt } from '../lib/format';
import { ApiError } from '../lib/api';
import { burst } from '../lib/effects';
import { PublicHeader } from '../components/PublicHeader';
import { Button } from '../components/Button';
import { Callout, Field, PageSkeleton, inputClass } from '../components/ui';

/** First run for a new farmer: name, district and a first field. */
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
  const [error, setError] = useState<string | null>(null);

  if (ref.isLoading || farms.isLoading || !ref.data) return <PageSkeleton cards={1} />;
  const hasFarm = !!farms.data?.length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateMe.mutateAsync({ name, districtId: farm.districtId });
      if (!hasFarm) await createFarm.mutateAsync(farm);
      void burst(e.currentTarget.querySelector('button[type=submit]'));
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.error'));
    }
  };

  const set = <K extends keyof FarmInput>(k: K, v: FarmInput[K]) => setFarm((f) => ({ ...f, [k]: v }));
  const district = ref.data.districts.find((d) => d.id === farm.districtId);

  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-2xl px-4 py-10">
        <form onSubmit={submit} className="card flex flex-col gap-5 sm:p-8">
          <div>
            <h1 className="font-display text-3xl">{t('onboard.title')}</h1>
            <p className="text-fg-muted">{t('onboard.lead')}</p>
          </div>
          {error && <Callout tone="bad" title={error} />}
          <Field label={t('onboard.name')} htmlFor="w-name">
            <input
              id="w-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </Field>
          {!hasFarm && (
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
          <Button type="submit" variant="primary" magnetic busy={updateMe.isPending || createFarm.isPending}>
            {t('onboard.save')}
          </Button>
        </form>
      </main>
    </>
  );
}
