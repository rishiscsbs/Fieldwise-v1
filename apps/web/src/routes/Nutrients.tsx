// Nutrient plan: a crop wheel, the per-nutrient breakdown, sacks that drop into a cart as the bag counts load
// (with the total counting up), and the application schedule drawn as a growing crop.
import { useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useFertiliser, useReference } from '../lib/queries';
import { CountUp } from '../components/CountUp';
import { SackCart } from '../components/SackCart';
import { FeedTimeline } from '../components/FeedTimeline';
import { WheelPicker } from '../components/signature/WheelPicker';
import { Callout, Card, ErrorState, LevelBadge, PageHeader, PageSkeleton } from '../components/ui';

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
      <div className="grid items-end gap-4 md:grid-cols-[1fr_16rem]">
        <PageHeader
          title={t('fert_lead', { ns: 'common', c: label(c.n), a: num(f.areaAcres, 2) })}
          sub={t('fert_sub', { ns: 'common' })}
        />
        <WheelPicker
          label={t('crop', { ns: 'common' })}
          options={ref.data.crops.map((x) => ({ value: x.id, label: label(x.n).split(' (')[0]! }))}
          value={f.cropId}
          onChange={(v) => setParams({ crop: v })}
          settle={350}
          height={168}
          className="mb-6"
        />
      </div>
      {f.usingDefaults && <Callout tone="info" title={t('defaults')} />}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="self-start lg:col-span-3"
          title={t('breakdown', { ns: 'common' })}
          sub={t('nutrients.perHa')}
        >
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
          <SackCart
            key={f.cropId}
            label={`${t('nutrients.cart')}: ${t('nutrients.cartAlt', { u: f.bags.urea, d: f.bags.dap, m: f.bags.mop })}`}
            moreLabel={(n) => t('nutrients.more', { n })}
            groups={(['urea', 'dap', 'mop'] as const).map((k) => ({
              id: k,
              code: k.toUpperCase(),
              colour: ref.data!.fertilisers.find((x) => x.id === k)!.colour,
              bags: f.bags[k],
            }))}
          />
          <ul className="mt-2 flex flex-col gap-3">
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
                  <span
                    aria-hidden="true"
                    className="h-7 w-5 shrink-0 rounded-sm border border-line"
                    style={{ background: fe.colour }}
                  />
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
            <span className="num-hero">
              <CountUp key={f.cropId} value={f.cost} format={money} duration={1200} />
            </span>
          </div>
        </Card>
      </div>

      <Card title={t('schedule', { ns: 'common' })}>
        <FeedTimeline
          key={f.cropId}
          stageLabel={(st) => t(`nutrients.stage.${st}`)}
          items={f.schedule.map((s) => ({
            key: s.key,
            text: t(s.key, { ns: 'advice', ...(s.args as Record<string, number>) }),
          }))}
        />
        <p className="mt-4 rounded-md bg-good-soft p-3 text-sm">{t('organic', { ns: 'advice' })}</p>
      </Card>
    </div>
  );
}
