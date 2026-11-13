import { Link, useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { useAuth } from '../stores/auth';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import {
  useAlerts,
  useFertiliser,
  useMandi,
  useRecommendations,
  useReference,
  useTickets,
  useWater,
} from '../lib/queries';
import { ChartFrame, DataTable, Legend, SERIES } from '../charts/frame';
import { Columns, HBars, Lines, RangeBars } from '../charts/charts';
import { CountUp } from '../components/CountUp';
import { Kpi } from '../components/Kpi';
import { WeatherHero } from '../components/WeatherHero';
import { Icon } from '../components/Icon';
import { Card, Callout, Empty, ErrorState, PageSkeleton, SourceBadge } from '../components/ui';

export function Overview() {
  const f = useFmt();
  const { t, label, short, money, num, signed, date } = f;
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const recs = useRecommendations(farm?.id);
  const fert = useFertiliser(farm?.id);
  const water = useWater(farm?.id);
  const mandi = useMandi(farm?.id);
  const alerts = useAlerts();
  const tickets = useTickets();

  const crop = ref.data?.crops.find((c) => c.id === recs.data?.activeCrop);
  const district = ref.data?.districts.find((d) => d.id === farm?.districtId);
  const season = ref.data?.seasons.find((s) => s.id === farm?.season);
  const best = mandi.data?.advice;
  const bestMarket = mandi.data?.markets.find((m) => m.market === best?.bestMarket);
  const next = water.data?.nextIrrigation;
  const score = recs.data?.list.find((x) => x.cropId === crop?.id)?.score ?? 0;

  useSay(
    crop && fert.data && water.data
      ? [
          t('crops_lead', { ns: 'common', c: label(crop.n), s: short(season?.labels) }),
          next
            ? t('irrNow', {
                ns: 'advice',
                d: date(next.date, { weekday: 'long', day: 'numeric', month: 'short' }),
                mm: next.mm,
              })
            : t('irrNone', { ns: 'advice' }),
          t('fertSay', {
            ns: 'advice',
            c: label(crop.n),
            u: fert.data.bags.urea,
            d: fert.data.bags.dap,
            m: fert.data.bags.mop,
            cost: Math.round(fert.data.cost),
          }),
        ].join('. ')
      : undefined,
  );

  if (recs.isError) return <ErrorState onRetry={() => void recs.refetch()} />;
  if (!farm || !ref.data || recs.isLoading || !crop) return <PageSkeleton />;

  const top = recs.data!.list.slice(0, 8);
  const open = (tickets.data ?? []).filter((x) => x.status === 'open');
  const days = water.data?.forecast.days ?? [];
  const dayLabel = (d: string) => date(d, { weekday: 'short' });
  const xDates =
    bestMarket?.series.map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (bestMarket.series.length - 1 - i));
      return date(d);
    }) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <WeatherHero
        title={t('overview.hello', { name: user.name.split(' ')[0] })}
        sub={t('ctx', {
          ns: 'common',
          d: label(district?.labels),
          s: short(season?.labels),
          a: num(farm.areaAcres, 2),
        })}
        today={days[0]}
      />

      {recs.data!.usingDefaults && (
        <Callout tone="info" title={t('defaults')}>
          <Link to="/app/farm" className="font-semibold text-primary underline">
            {t('addCard')}
          </Link>
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          index={0}
          size="text"
          icon="planner"
          label={t('kpi_crop', { ns: 'common' })}
          value={
            <span>
              {crop.e} {label(crop.n).split(' (')[0]}
            </span>
          }
          meta={t('kpi_score', { ns: 'common', s: score })}
        />
        <Kpi
          index={1}
          icon="drop"
          label={t('kpi_irr', { ns: 'common' })}
          value={
            water.data
              ? next
                ? date(next.date, { weekday: 'short', day: 'numeric' })
                : t('kpi_none', { ns: 'common' })
              : '…'
          }
          meta={next ? `${next.mm} mm` : t('kpi_none_m', { ns: 'common' })}
        />
        <Kpi
          index={2}
          icon="nutrients"
          label={t('kpi_cost', { ns: 'common' })}
          value={fert.data ? <CountUp value={fert.data.cost} format={money} /> : '…'}
          meta={t('kpi_field', { ns: 'common', a: num(farm.areaAcres, 2) })}
        />
        <Kpi
          index={3}
          icon="market"
          label={t('kpi_price', { ns: 'common' })}
          value={best ? <CountUp value={best.bestPrice} format={money} /> : '…'}
          meta={
            best && bestMarket
              ? bestMarket.change !== null
                ? t('kpi_wk', { ns: 'common', ch: signed(bestMarket.change), m: best.bestMarket })
                : best.bestMarket
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title={t('ch_suit', { ns: 'common' })}
          sub={t('ch_suit_sub', { ns: 'common' })}
          actions={
            <Link to="/app/planner" className="btn-quiet">
              {t('viewAll', { ns: 'common' })}
            </Link>
          }
        >
          <ChartFrame
            label={t('ch_suit', { ns: 'common' })}
            chart={
              <HBars
                data={top.map((x) => ({
                  id: x.cropId,
                  value: x.score,
                  active: x.cropId === crop.id,
                  label: label(ref.data!.crops.find((c) => c.id === x.cropId)?.n),
                }))}
                onSelect={(id) => navigate(`/app/planner/${id}`)}
              />
            }
            table={
              <DataTable
                head={[t('crop', { ns: 'common' }), t('score', { ns: 'common' })]}
                numeric={[1]}
                rows={top.map((x) => [label(ref.data!.crops.find((c) => c.id === x.cropId)?.n), x.score])}
              />
            }
          />
        </Card>
        <Card
          className="lg:col-span-2"
          title={t('alertsT', { ns: 'common' })}
          actions={
            <Link to="/app/desk" className="btn-quiet">
              {t('viewAll', { ns: 'common' })}
            </Link>
          }
        >
          {!alerts.data?.length ? (
            <Empty>{t('noAlerts', { ns: 'common' })}</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {alerts.data.slice(0, 3).map((a, i) => (
                // Alerts slide in from the right edge, one after another.
                <m.li
                  key={a.id}
                  initial={{ opacity: 0, x: 48 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 260, damping: 26 }}
                >
                  <Callout tone={a.level === 'bad' ? 'bad' : a.level === 'warn' ? 'warn' : 'info'}>
                    <p className="text-base">{label(a.labels)}</p>
                    <time className="text-xs text-fg-muted" dateTime={a.createdAt}>
                      {f.time(a.createdAt)} · {a.author.name}
                    </time>
                  </Callout>
                </m.li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={t('ch_rain', { ns: 'common' })}
          sub={t('ch_rain_sub', { ns: 'common' })}
          actions={water.data && <SourceBadge simulated={water.data.forecast.simulated} label="" />}
        >
          {water.data ? (
            <ChartFrame
              label={t('ch_rain', { ns: 'common' })}
              chart={
                <Columns
                  unit="mm"
                  emptyLabel={t('weather.noRain')}
                  data={days.map((d) => ({
                    label: dayLabel(d.date),
                    title: date(d.date, { weekday: 'long', day: 'numeric', month: 'short' }),
                    value: d.rain,
                  }))}
                />
              }
              table={
                <DataTable
                  head={[
                    t('day', { ns: 'common' }),
                    `${t('rain', { ns: 'common' })} (mm)`,
                    t('rainP', { ns: 'common' }),
                  ]}
                  numeric={[1, 2]}
                  rows={days.map((d) => [
                    date(d.date, { weekday: 'short', day: 'numeric' }),
                    d.rain,
                    `${d.rp}%`,
                  ])}
                />
              }
            />
          ) : (
            <PageSkeleton cards={1} />
          )}
        </Card>
        <Card title={t('ch_temp', { ns: 'common' })} sub={t('ch_temp_sub', { ns: 'common' })}>
          {water.data ? (
            <ChartFrame
              label={t('ch_temp', { ns: 'common' })}
              legend={
                <Legend
                  items={[
                    { label: t('chart.max'), color: SERIES[3] },
                    { label: t('chart.min'), color: SERIES[1] },
                  ]}
                />
              }
              chart={
                <RangeBars
                  minLabel={t('chart.min')}
                  maxLabel={t('chart.max')}
                  data={days.map((d) => ({
                    label: dayLabel(d.date),
                    title: date(d.date, { weekday: 'long', day: 'numeric', month: 'short' }),
                    lo: d.tmin,
                    hi: d.tmax,
                  }))}
                />
              }
              table={
                <DataTable
                  head={[t('day', { ns: 'common' }), `${t('chart.min')} °C`, `${t('chart.max')} °C`]}
                  numeric={[1, 2]}
                  rows={days.map((d) => [date(d.date, { weekday: 'short', day: 'numeric' }), d.tmin, d.tmax])}
                />
              }
            />
          ) : (
            <PageSkeleton cards={1} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title={t('ch_mandi', { ns: 'common', c: label(crop.n) })}
          sub={t('ch_mandi_sub', { ns: 'common' })}
          actions={mandi.data && <SourceBadge simulated={mandi.data.source.simulated} label="" />}
        >
          {mandi.data && mandi.data.source.historyDays > 1 ? (
            <ChartFrame
              label={t('ch_mandi', { ns: 'common', c: label(crop.n) })}
              legend={
                <Legend
                  items={mandi.data.markets.map((m, i) => ({ label: m.market, color: SERIES[i % 4]! }))}
                />
              }
              chart={
                <Lines
                  height={220}
                  xLabels={xDates}
                  format={money}
                  series={mandi.data.markets.map((m, i) => ({
                    label: m.market,
                    values: m.series,
                    color: SERIES[i % 4]!,
                  }))}
                  reference={
                    mandi.data.msp ? { value: mandi.data.msp, label: t('market.mspLine') } : undefined
                  }
                />
              }
              table={
                <DataTable
                  head={[
                    t('market', { ns: 'common' }),
                    t('today', { ns: 'common' }),
                    t('wk', { ns: 'common' }),
                  ]}
                  numeric={[1, 2]}
                  rows={mandi.data.markets.map((m) => [
                    m.market,
                    money(m.today),
                    m.change === null ? '—' : `${signed(m.change)}%`,
                  ])}
                />
              }
            />
          ) : mandi.data ? (
            <Empty>{t('source.todayOnly')}</Empty>
          ) : (
            <PageSkeleton cards={1} />
          )}
        </Card>
        <Card
          className="lg:col-span-2"
          title={t('queriesT', { ns: 'common' })}
          actions={
            <Link to="/app/desk" className="btn-quiet">
              {t('viewAll', { ns: 'common' })}
            </Link>
          }
        >
          {!open.length ? (
            <Empty>{t('noOpen', { ns: 'common' })}</Empty>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {open.slice(0, 4).map((x) => (
                <li key={x.id}>
                  <Link to={`/app/desk/${x.id}`} className="flex items-start gap-3 py-3 hover:text-primary">
                    <Icon name="desk" size={18} className="mt-1 text-fg-muted" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{x.subject}</span>
                      <span className="text-xs text-fg-muted">{f.time(x.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
