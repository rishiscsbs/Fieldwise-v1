import { useSay } from '../stores/page';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { condition } from '../lib/weather';
import { useReference, useWater } from '../lib/queries';
import { ChartFrame, DataTable, Legend, SERIES } from '../charts/frame';
import { Columns, RangeBars } from '../charts/charts';
import { MoistureGauge } from '../components/MoistureGauge';
import { Sky } from '../components/Sky';
import { Badge, Callout, Card, ErrorState, PageHeader, PageSkeleton, SourceBadge } from '../components/ui';

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

      <Sky cond={cond}>
        <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[1fr_auto]">
          <div className="rounded-md bg-surface/90 p-4 text-fg shadow-1 backdrop-blur">
            <p className="text-sm text-fg-muted">
              {t('weather.today')} · {date(today.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="font-display text-4xl">
              {today.tmax}° <span className="text-2xl text-fg-muted">/ {today.tmin}°</span>
            </p>
            <p className="font-semibold">{t(`weather.cond.${cond}`)}</p>
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
          <div className="rounded-md bg-surface/90 p-4 text-fg shadow-1 backdrop-blur">
            <p className="font-semibold">{t('weather.moisture')}</p>
            <p className="mb-2 text-sm text-fg-muted">
              {t('weather.moistureSub', { soil: label(soil?.labels) })}
            </p>
            <MoistureGauge left={left} capacity={w.thresholdMm} label={t('weather.moisture')} />
          </div>
        </div>
      </Sky>

      <Callout tone="info" title={`${lead}.`} />
      {w.fungalRisk && <Callout tone="warn" title={t('fungal', { ns: 'advice' })} />}

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
