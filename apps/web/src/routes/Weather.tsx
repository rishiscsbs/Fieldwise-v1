// Weather and irrigation: an animated sky banner for today's forecast (rain, heat shimmer or sun, from the same
// effects as the overview), the week as illustrated day cards with a soil-water column each and a bouncing drop
// on irrigation days, then the full irrigation table and the charts.
import { m } from 'framer-motion';
import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { condition, type Condition } from '../lib/weather';
import { useReference, useWater } from '../lib/queries';
import { ChartFrame, DataTable, Legend, SERIES } from '../charts/frame';
import { Columns, RangeBars } from '../charts/charts';
import { MoistureGauge, WaterColumn } from '../components/MoistureGauge';
import { SkyIcon } from '../components/SkyIcon';
import { WeatherFx } from '../components/WeatherFx';
import { Badge, Callout, Card, ErrorState, PageHeader, PageSkeleton, SourceBadge } from '../components/ui';

/** A water drop that bounces gently: marks the days to irrigate. */
function IrrigationDrop() {
  return (
    <m.svg
      width="16"
      height="20"
      viewBox="0 0 16 20"
      aria-hidden="true"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <path d="M8 1C4 7 1 10 1 13.5a7 7 0 0 0 14 0C15 10 12 7 8 1Z" fill="var(--series-2)" />
      <path
        d="M5 13a3 3 0 0 0 3 3"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity=".8"
      />
    </m.svg>
  );
}

export function Weather() {
  const { t, label, date, time } = useFmt();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const water = useWater(farm?.id);
  const w = water.data;
  const crop = ref.data?.crops.find((c) => c.id === w?.cropId);
  const long = (d: string) => date(d, { weekday: 'long', day: 'numeric', month: 'short' });
  const lead = w
    ? w.nextIrrigation
      ? t('irrNow', { ns: 'advice', d: long(w.nextIrrigation.date), mm: w.nextIrrigation.mm })
      : t('irrNone', { ns: 'advice' })
    : '';

  useSay(
    w
      ? `${lead}. ${t('sprayOk', { ns: 'common' })}: ${w.sprayDays.map((d) => date(d, { weekday: 'long' })).join(', ')}`
      : undefined,
  );

  if (water.isError) return <ErrorState onRetry={() => void water.refetch()} />;
  if (!farm || !ref.data || !w || !crop) return <PageSkeleton cards={3} />;

  const days = w.forecast.days;
  const today = days[0]!;
  const cond = condition(today);
  const soil = ref.data.soils.find((s) => s.id === farm.soil);
  const left = Math.max(0, w.thresholdMm - (w.days[0]?.def ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('pt_weather', { ns: 'common' })}
        sub={t('weather_sub', { ns: 'common', c: label(crop.n) })}
      />

      {/* The sky banner: season wash and today's weather effects behind solid data panels. */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-season-c shadow-glass">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-season-c via-season-c to-surface"
        />
        <WeatherFx cond={cond} hot={today.tmax >= 36} morning={new Date().getHours() < 11} />
        <div className="relative grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_auto]">
          <div className="rounded-xl bg-surface p-5 text-fg shadow-2">
            <p className="text-sm text-fg-muted">
              {t('weather.today')} · {date(today.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="mt-1 flex items-center gap-4">
              <SkyIcon cond={cond} size={72} />
              <p className="num-hero">
                {today.tmax}° <span className="text-3xl text-fg-muted">/ {today.tmin}°</span>
              </p>
            </div>
            <p className="mt-1 text-lg font-semibold">{t(`weather.cond.${cond}`)}</p>
            <p className="num mt-1 text-sm text-fg-muted">
              {t('rainP', { ns: 'common' })} {today.rp}% · {t('humT', { ns: 'common' })} {today.hum}% ·{' '}
              {t('windT', { ns: 'common' })} {today.wind} km/h
            </p>
            <div className="mt-3">
              <SourceBadge
                simulated={w.forecast.simulated}
                label={`${w.forecast.simulated ? t('source.simWeather') : t('source.openMeteo')} · ${t('source.updated', { time: time(w.forecast.fetchedAt) })}`}
              />
            </div>
          </div>
          <div className="rounded-xl bg-surface p-5 text-fg shadow-2">
            <p className="font-semibold">{t('weather.moisture')}</p>
            <p className="mb-2 text-sm text-fg-muted">
              {t('weather.moistureSub', { soil: label(soil?.labels) })}
            </p>
            <MoistureGauge left={left} capacity={w.thresholdMm} label={t('weather.moisture')} />
          </div>
        </div>
      </section>

      <Callout tone="info" title={`${lead}.`} />
      {w.fungalRisk && <Callout tone="warn" title={t('fungal', { ns: 'advice' })} />}

      <Card title={t('weather.week')}>
        <ol className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-7 lg:overflow-visible">
          {days.map((d, i) => {
            const wd = w.days[i]!;
            const c: Condition = condition(d);
            const water = w.thresholdMm ? Math.max(0, w.thresholdMm - wd.def) / w.thresholdMm : 0;
            return (
              <m.li
                key={d.date}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06, duration: 0.4 }}
                className={`relative flex min-w-[8.5rem] snap-start flex-col items-center gap-1.5 rounded-xl border p-3 text-center ${wd.irr ? 'border-series-2 bg-info-soft' : 'border-line bg-surface'}`}
              >
                <span className="font-semibold">
                  {i === 0 ? t('weather.today') : date(d.date, { weekday: 'short' })}
                </span>
                <span className="text-xs text-fg-muted">
                  {date(d.date, { day: 'numeric', month: 'short' })}
                </span>
                <SkyIcon cond={c} size={44} />
                <span className="sr-only">{t(`weather.cond.${c}`)}</span>
                <span className="num font-bold">
                  {d.tmax}° <span className="font-normal text-fg-muted">{d.tmin}°</span>
                </span>
                <span className="num text-xs text-fg-muted">
                  {t('rain', { ns: 'common' })} {d.rain} mm
                </span>
                <span className="flex items-center gap-2">
                  <WaterColumn pct={water} delay={0.2 + i * 0.06} />
                  <span className="num text-xs">
                    {t('weather.waterLeft', { p: Math.round(water * 100) })}
                  </span>
                </span>
                {wd.irr ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-info">
                    <IrrigationDrop />
                    {t('weather.irrigateMm', { mm: wd.irr })}
                  </span>
                ) : (
                  <span className="mt-1 text-sm text-fg-muted">{t('noirr', { ns: 'common' })}</span>
                )}
              </m.li>
            );
          })}
        </ol>
      </Card>

      <Card title={t('irrPlan', { ns: 'common' })} sub={t('asOf', { ns: 'common' })}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-line text-left text-fg-muted">
                {[
                  t('day', { ns: 'common' }),
                  t('weather.conditions'),
                  `${t('tempT', { ns: 'common' })} °C`,
                  t('rainP', { ns: 'common' }),
                  `${t('rain', { ns: 'common' })} mm`,
                  `${t('windT', { ns: 'common' })} km/h`,
                  'ETc mm',
                  t('irrigation', { ns: 'common' }),
                  t('sprayWin', { ns: 'common' }),
                ].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={`px-2 py-2 font-semibold ${i >= 2 && i <= 6 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const wd = w.days[i]!;
                return (
                  <tr key={d.date} className="border-b border-line last:border-0">
                    <th scope="row" className="px-2 py-2 text-left font-semibold">
                      {date(d.date, { weekday: 'short', day: 'numeric', month: 'numeric' })}
                    </th>
                    <td className="px-2 py-2">{t(`weather.cond.${condition(d)}`)}</td>
                    <td className="num px-2 py-2 text-right">
                      {d.tmax} / {d.tmin}
                    </td>
                    <td className="num px-2 py-2 text-right">{d.rp}%</td>
                    <td className="num px-2 py-2 text-right">{d.rain}</td>
                    <td className="num px-2 py-2 text-right">{d.wind}</td>
                    <td className="num px-2 py-2 text-right">{wd.etc.toFixed(1)}</td>
                    <td className="px-2 py-2">
                      {wd.irr ? (
                        <Badge tone="info">{`${t('irr', { ns: 'common' })} ${wd.irr} mm`}</Badge>
                      ) : (
                        <span className="text-fg-muted">{t('noirr', { ns: 'common' })}</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {wd.spray ? (
                        <Badge tone="good">{t('sprayOk', { ns: 'common' })}</Badge>
                      ) : (
                        <Badge tone="bad">{t('sprayNo', { ns: 'common' })}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-fg-muted">{t('howCalc', { ns: 'common' })}</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('ch_rain', { ns: 'common' })} sub={t('ch_rain_sub', { ns: 'common' })}>
          <ChartFrame
            label={t('ch_rain', { ns: 'common' })}
            chart={
              <Columns
                unit="mm"
                emptyLabel={t('weather.noRain')}
                data={days.map((d) => ({
                  label: date(d.date, { weekday: 'short' }),
                  title: long(d.date),
                  value: d.rain,
                }))}
              />
            }
            table={
              <DataTable
                head={[t('day', { ns: 'common' }), 'mm', t('rainP', { ns: 'common' })]}
                numeric={[1, 2]}
                rows={days.map((d) => [long(d.date), d.rain, `${d.rp}%`])}
              />
            }
          />
        </Card>
        <Card title={t('ch_temp', { ns: 'common' })} sub={t('ch_temp_sub', { ns: 'common' })}>
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
                  label: date(d.date, { weekday: 'short' }),
                  title: long(d.date),
                  lo: d.tmin,
                  hi: d.tmax,
                }))}
              />
            }
            table={
              <DataTable
                head={[t('day', { ns: 'common' }), `${t('chart.min')} °C`, `${t('chart.max')} °C`]}
                numeric={[1, 2]}
                rows={days.map((d) => [long(d.date), d.tmin, d.tmax])}
              />
            }
          />
        </Card>
      </div>
    </div>
  );
}
