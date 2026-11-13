// Market prices: a crop wheel, the best price today as a big number, and the trend chart with the best market
// glowing and MSP drawn as a dashed threshold.
import { useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { useMandi, useReference } from '../lib/queries';
import { ChartFrame, DataTable, Legend, SERIES } from '../charts/frame';
import { Lines } from '../charts/charts';
import { CountUp } from '../components/CountUp';
import { Icon } from '../components/Icon';
import { WheelPicker } from '../components/signature/WheelPicker';
import { Badge, Callout, Card, ErrorState, PageHeader, PageSkeleton, SourceBadge } from '../components/ui';

export function Market() {
  const { t, label, money, signed, date, time } = useFmt();
  const [params, setParams] = useSearchParams();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const mandi = useMandi(farm?.id, params.get('crop') ?? undefined);
  const md = mandi.data;
  const crop = ref.data?.crops.find((c) => c.id === md?.cropId);
  const lead =
    md?.advice && crop
      ? t('mandi_lead', {
          ns: 'common',
          c: label(crop.n),
          m: md.advice.bestMarket,
          p: Math.round(md.advice.bestPrice).toLocaleString('en-IN'),
        })
      : '';

  useSay(md?.advice ? `${lead}. ${t(md.advice.key, { ns: 'advice' })}` : undefined);

  if (mandi.isError) return <ErrorState onRetry={() => void mandi.refetch()} />;
  if (!farm || !ref.data || !md || !crop) return <PageSkeleton cards={2} />;

  const n = md.markets[0]?.series.length ?? 0;
  const xLabels = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return date(d);
  });
  const best = md.markets.find((m) => m.market === md.advice?.bestMarket);
  const adviceTone =
    md.advice?.key === 'belowMsp' || md.advice?.key === 'falling'
      ? 'warn'
      : md.advice?.key === 'rising'
        ? 'good'
        : 'info';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_16rem]">
        <PageHeader title={lead || t('pt_market', { ns: 'common' })} sub={t('mandi_sub', { ns: 'common' })} />
        <WheelPicker
          label={t('crop', { ns: 'common' })}
          options={ref.data.crops.map((c) => ({ value: c.id, label: label(c.n).split(' (')[0]! }))}
          value={md.cropId}
          onChange={(v) => setParams({ crop: v })}
          settle={350}
          className="mb-6"
        />
      </div>

      {best && (
        <m.section
          key={md.cropId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card relative flex flex-wrap items-end justify-between gap-4 overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-season-a via-season-b to-season-c"
          />
          <div>
            <p className="text-sm font-semibold text-fg-muted">{t('market.bestToday')}</p>
            <p className="num-hero">
              <CountUp value={best.today} format={money} duration={1100} />
            </p>
            <p className="font-semibold">{t('market.at', { m: best.market })}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            {best.change !== null && (
              <span
                className={`num inline-flex items-center gap-1 text-lg font-bold ${best.change >= 0 ? 'text-good' : 'text-bad'}`}
              >
                <Icon name="arrowRight" size={18} className={best.change >= 0 ? '-rotate-45' : 'rotate-45'} />
                {signed(best.change)}%{' '}
                <span className="text-sm font-normal text-fg-muted">{t('wk', { ns: 'common' })}</span>
              </span>
            )}
            {md.msp !== null && (
              <Badge tone={best.today >= md.msp ? 'good' : 'warn'}>
                {best.today >= md.msp ? t('market.aboveMsp') : t('market.belowMsp')} · {money(md.msp)}
              </Badge>
            )}
          </div>
        </m.section>
      )}

      <SourceBadge
        simulated={md.source.simulated}
        label={`${md.source.simulated ? t('source.simMandi') : t('source.agmarknet')} · ${t('source.updated', { time: time(md.fetchedAt) })}`}
      />
      {md.advice && <Callout tone={adviceTone} title={t(md.advice.key, { ns: 'advice' })} />}

      <Card
        title={t('ch_mandi', { ns: 'common', c: label(crop.n) })}
        sub={t('ch_mandi_sub', { ns: 'common' })}
      >
        {md.source.historyDays > 1 ? (
          <ChartFrame
            label={t('ch_mandi', { ns: 'common', c: label(crop.n) })}
            legend={
              <Legend
                items={[
                  ...md.markets.map((m, i) => ({ label: m.market, color: SERIES[i % 4]! })),
                  ...(md.msp
                    ? [{ label: t('market.mspLine'), color: 'var(--text-muted)', dashed: true }]
                    : []),
                ]}
              />
            }
            chart={
              <Lines
                height={300}
                xLabels={xLabels}
                format={money}
                series={md.markets.map((m, i) => ({
                  label: m.market,
                  values: m.series,
                  color: SERIES[i % 4]!,
                }))}
                reference={md.msp ? { value: md.msp, label: t('market.mspLine') } : undefined}
                highlight={md.advice?.bestMarket}
              />
            }
            table={
              <DataTable
                head={[t('day', { ns: 'common' }), ...md.markets.map((m) => m.market)]}
                numeric={md.markets.map((_, i) => i + 1)}
                rows={xLabels.map((d, i) => [d, ...md.markets.map((m) => money(m.series[i] ?? 0))])}
              />
            }
          />
        ) : (
          <p className="text-fg-muted">{t('source.todayOnly')}</p>
        )}
      </Card>

      <Card title={t('market', { ns: 'common' })}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-line text-left text-fg-muted">
                <th scope="col" className="py-2 pr-2">
                  {t('market', { ns: 'common' })}
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  {t('today', { ns: 'common' })}
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  {t('wk', { ns: 'common' })}
                </th>
                <th scope="col" className="py-2 pl-2">
                  {t('msp', { ns: 'common' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {[...md.markets]
                .sort((a, b) => b.today - a.today)
                .map((m) => (
                  <tr key={m.market} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold">
                      {m.market}{' '}
                      {m.market === md.advice?.bestMarket && <Badge tone="good">{t('market.best')}</Badge>}
                    </th>
                    <td className="num px-2 py-2 text-right font-semibold">{money(m.today)}</td>
                    <td className={`num px-2 py-2 text-right ${m.change === null ? 'text-fg-muted' : ''}`}>
                      {m.change === null ? '—' : `${m.change >= 0 ? '▲' : '▼'} ${signed(m.change)}%`}
                    </td>
                    <td className="py-2 pl-2">
                      {md.msp === null ? (
                        <span className="text-fg-muted">{t('noMsp', { ns: 'common' })}</span>
                      ) : m.today < md.msp ? (
                        <Badge tone="warn">{`< ${money(md.msp)}`}</Badge>
                      ) : (
                        <Badge tone="good">{`≥ ${money(md.msp)}`}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
