import { useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useFertiliser, useReference } from '../lib/queries';
import { CountUp } from '../components/CountUp';
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

const NUTRIENTS = ['N', 'P₂O₅', 'K₂O'];

export function Nutrients() {
  const { t, label, num, money } = useFmt();
  const [params, setParams] = useSearchParams();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const crop = params.get('crop') ?? undefined;
  const fert = useFertiliser(farm?.id, crop);
  const c = ref.data?.crops.find((x) => x.id === fert.data?.cropId);

  useSay(
    fert.data && c
      ? t('fertSay', {
          ns: 'advice',
          c: label(c.n),
          u: fert.data.bags.urea,
          d: fert.data.bags.dap,
          m: fert.data.bags.mop,
          cost: Math.round(fert.data.cost),
        })
      : undefined,
  );

  if (fert.isError) return <ErrorState onRetry={() => void fert.refetch()} />;
  if (!farm || !ref.data || !fert.data || !c) return <PageSkeleton cards={3} />;
  const f = fert.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('fert_lead', { ns: 'common', c: label(c.n), a: num(f.areaAcres, 2) })}
        sub={t('fert_sub', { ns: 'common' })}
        actions={
          <Field label={t('crop', { ns: 'common' })} htmlFor="n-crop">
            <select
              id="n-crop"
              value={f.cropId}
              onChange={(e) => setParams({ crop: e.target.value })}
              className={inputClass}
            >
              {ref.data.crops.map((x) => (
                <option key={x.id} value={x.id}>
                  {label(x.n)}
                </option>
              ))}
            </select>
          </Field>
        }
      />
      {f.usingDefaults && <Callout tone="info" title={t('defaults')} />}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={t('breakdown', { ns: 'common' })} sub={t('nutrients.perHa')}>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-left text-fg-muted">
                  <th scope="col" className="py-2 pr-2">
                    {t('nutrient', { ns: 'common' })}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t('nutrients.levels')}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    {t('rec', { ns: 'common' })}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    {t('adj', { ns: 'common' })}
                  </th>
                  <th scope="col" className="py-2 pl-2 text-right">
                    {t('kg', { ns: 'common' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {NUTRIENTS.map((n, i) => (
                  <tr key={n} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold">
                      {n}
                    </th>
                    <td className="px-2 py-2">
                      <LevelBadge level={f.levels[i]!} />
                    </td>
                    <td className="num px-2 py-2 text-right">{num(f.recommendedPerHa[i]!)}</td>
                    <td className="num px-2 py-2 text-right font-semibold">{num(f.adjustedPerHa[i]!)}</td>
                    <td className="num py-2 pl-2 text-right">{num(f.perField[i]!, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title={t('products', { ns: 'common' })}
          sub={t('nutrients.priceNote')}
        >
          <ul className="flex flex-col gap-3">
            {(['urea', 'dap', 'mop'] as const).map((k, i) => {
              const fe = ref.data!.fertilisers.find((x) => x.id === k)!;
              const bags = f.bags[k];
              return (
                <m.li
                  key={k}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  {/* Bags drawn in the product's real colour; the count is also written out */}
                  <div className="flex w-24 shrink-0 flex-wrap gap-0.5" aria-hidden="true">
                    {Array.from({ length: Math.min(bags, 12) }, (_, b) => (
                      <m.span
                        key={b}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 + b * 0.04, type: 'spring', stiffness: 500, damping: 22 }}
                        className="h-5 w-3.5 rounded-sm border border-line"
                        style={{ background: fe.colour }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{label(fe.labels)}</div>
                    <div className="text-sm text-fg-muted">
                      {t('nutrients.bagsOf', { count: bags, kg: fe.bagKg })} · {num(f.kg[k])}{' '}
                      {t('kg', { ns: 'common' })}
                    </div>
                  </div>
                  <div className="num font-semibold">{money(bags * fe.cost)}</div>
                </m.li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-semibold">{t('cost', { ns: 'common' })}</span>
            <span className="num font-display text-3xl">
              <CountUp value={f.cost} format={money} />
            </span>
          </div>
        </Card>
      </div>

      <Card title={t('schedule', { ns: 'common' })}>
        <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-6">
          {f.schedule.map((s, i) => (
            <m.li
              key={s.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1 }}
              className="relative"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[33px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-surface bg-primary"
              />
              {t(s.key, { ns: 'advice', ...(s.args as Record<string, number>) })}
            </m.li>
          ))}
        </ol>
        <p className="mt-4 rounded-md bg-good-soft p-3 text-sm">{t('organic', { ns: 'advice' })}</p>
      </Card>
    </div>
  );
}
