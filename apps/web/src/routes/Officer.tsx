import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useAuth } from '../stores/auth';
import { useSay } from '../stores/page';
import { useFmt } from '../lib/format';
import { useOfficerMap, useOfficerSummary, usePestPoints, useReference, useTickets } from '../lib/queries';
import { ChartFrame, DataTable, Legend, SERIES } from '../charts/frame';
import { HBars, Lines } from '../charts/charts';
import { DistrictMap } from '../maps/DistrictMap';
import { CountUp } from '../components/CountUp';
import { Kpi } from '../components/Kpi';
import { Icon } from '../components/Icon';
import { EmptyState } from '../components/EmptyState';
import {
  Badge,
  Card,
  Empty,
  ErrorState,
  Field,
  PageHeader,
  PageSkeleton,
  inputClass,
} from '../components/ui';

const PERIODS = [30, 60, 90] as const;

export function Officer() {
  const role = useAuth((s) => s.user?.role);
  return role === 'officer' || role === 'admin' ? <OfficerPage /> : <Navigate to="/app" replace />;
}

function OfficerPage() {
  const { t, label, num, date, short } = useFmt();
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ref = useReference();
  const isAdmin = user.role === 'admin';
  const districtId = isAdmin ? (params.get('district') ?? 'nagpur') : undefined;
  const days = Number(params.get('days') ?? 30);
  const [pestId, setPestId] = useState('');
  const [layers, setLayers] = useState({ farms: true, tickets: true, pests: true });

  const summary = useOfficerSummary(districtId, days);
  const map = useOfficerMap(districtId);
  const pests = usePestPoints(districtId, days, pestId || undefined);
  const tickets = useTickets();

  const s = summary.data;
  const district = ref.data?.districts.find((d) => d.id === (s?.districtId ?? districtId));
  const districtName = label(district?.labels).split(',')[0] ?? '';
  const hours = (h: number) =>
    h >= 48 ? t('officer.daysShort', { n: Math.round(h / 24) }) : t('officer.hours', { n: Math.round(h) });
  const ago = (iso: string) => hours((Date.now() - new Date(iso).getTime()) / 3_600_000);

  useSay(
    s
      ? [
          t('officer.title'),
          districtName,
          `${t('officer.kpi.open')}: ${s.tickets.open}`,
          s.medianResponseHours !== null
            ? `${t('officer.kpi.response')}: ${hours(s.medianResponseHours)}`
            : '',
          `${t('officer.kpi.pests')}: ${s.pestReports}`,
        ].join('. ')
      : undefined,
  );

  if (summary.isError) return <ErrorState onRetry={() => void summary.refetch()} />;
  if (!s || !ref.data) return <PageSkeleton cards={4} />;

  const pestName = (id: string) => label(ref.data!.pests.find((p) => p.id === id)?.n);
  const cropName = (id: string | null) => (id ? label(ref.data!.crops.find((c) => c.id === id)?.n) : '—');
  const queue = (tickets.data ?? [])
    .filter((x) => x.status === 'open' && x.districtId === s.districtId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('officer.title')} sub={t('officer.sub', { district: label(district?.labels) })} />

      {/* Filters: one row, above everything they scope */}
      <div className="flex flex-wrap items-end gap-3">
        {isAdmin && (
          <Field label={t('officer.district')} htmlFor="o-district">
            <select
              id="o-district"
              value={districtId}
              onChange={(e) => setParam('district', e.target.value)}
              className={inputClass}
            >
              {ref.data.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {label(d.labels)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div
          role="group"
          aria-label={t('officer.period')}
          className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-1"
        >
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setParam('days', String(d))}
              className={`relative min-h-10 rounded-md px-4 text-sm font-semibold transition-colors duration-1 ${days === d ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
            >
              {days === d && (
                <m.span
                  layoutId="officer-period"
                  className="absolute inset-0 rounded-md bg-accent-soft"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span className="relative">{t('officer.days', { n: d })}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          index={0}
          icon="officer"
          label={t('officer.kpi.farmers')}
          value={<CountUp value={s.farmers} format={(n) => num(n)} />}
          meta={t('officer.kpi.farmersMeta', { farms: s.farms, acres: num(s.areaAcres) })}
        />
        <Kpi
          index={1}
          icon="desk"
          label={t('officer.kpi.open')}
          value={<CountUp value={s.tickets.open} format={(n) => num(n)} />}
          meta={
            s.oldestOpenHours !== null
              ? t('officer.kpi.openMeta', { t: hours(s.oldestOpenHours) })
              : t('officer.kpi.openNone')
          }
        />
        <Kpi
          index={2}
          icon="send"
          label={t('officer.kpi.response')}
          value={s.medianResponseHours !== null ? hours(s.medianResponseHours) : '—'}
          meta={t('officer.kpi.responseMeta', { n: days })}
        />
        <Kpi
          index={3}
          icon="health"
          label={t('officer.kpi.pests')}
          value={<CountUp value={s.pestReports} format={(n) => num(n)} />}
          meta={t('officer.kpi.pestsMeta', { count: s.alertsSent })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card
          title={t('officer.map')}
          sub={t('officer.mapSub')}
          actions={
            <Field label={t('officer.pest')} htmlFor="o-pest">
              <select
                id="o-pest"
                value={pestId}
                onChange={(e) => setPestId(e.target.value)}
                className={`${inputClass} min-h-10 text-sm`}
              >
                <option value="">{t('officer.allPests')}</option>
                {s.topPests.map((p) => (
                  <option key={p.pestId} value={p.pestId}>
                    {pestName(p.pestId)}
                  </option>
                ))}
              </select>
            </Field>
          }
        >
          <fieldset className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <legend className="sr-only">{t('officer.layers')}</legend>
            {(
              [
                ['farms', t('officer.layerFarms'), SERIES[0]],
                ['tickets', t('officer.layerTickets'), 'var(--warn)'],
                ['pests', t('officer.layerPests'), SERIES[3]],
              ] as const
            ).map(([k, l, color]) => (
              <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={layers[k]}
                  onChange={(e) => setLayers((x) => ({ ...x, [k]: e.target.checked }))}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: color }} />
                {l}
              </label>
            ))}
          </fieldset>
          {map.data ? (
            <ChartFrame
              label={t('officer.map')}
              chart={
                <DistrictMap
                  data={map.data}
                  pests={pests.data?.reports ?? []}
                  layers={layers}
                  onTicket={(id) => navigate(`/app/desk/${id}`)}
                  labels={{
                    map: `${t('officer.map')}: ${districtName}`,
                    locator: t('officer.locator'),
                    farm: t('officer.farm'),
                    farmer: t('officer.farmer'),
                    crop: t('crop', { ns: 'common' }),
                    area: t('area', { ns: 'common' }),
                    waiting: (iso) => t('officer.waiting', { t: ago(iso) }),
                    cropName,
                    district: districtName,
                  }}
                />
              }
              table={
                <DataTable
                  head={[
                    t('officer.farm'),
                    t('officer.farmer'),
                    t('crop', { ns: 'common' }),
                    t('area', { ns: 'common' }),
                    t('officer.layerTickets'),
                  ]}
                  numeric={[3, 4]}
                  rows={map.data.farms.map((f) => [
                    f.name,
                    f.farmer,
                    cropName(f.crop),
                    num(f.areaAcres, 2),
                    f.openTickets,
                  ])}
                />
              }
            />
          ) : (
            <PageSkeleton cards={1} />
          )}
          <p className="mt-2 text-xs text-fg-muted">{t('officer.heatNote')}</p>
        </Card>

        <Card title={t('officer.queue')} sub={t('officer.queueSub')}>
          {!queue.length ? (
            <EmptyState
              art="bird"
              action={
                <Link to="/app/desk" className="btn-secondary">
                  <Icon name="alert" size={18} />
                  {t('sendAlert', { ns: 'common' })}
                </Link>
              }
            >
              {t('empty.queue')}
            </EmptyState>
          ) : (
            <ol className="flex flex-col gap-2">
              {queue.map((x, i) => (
                <m.li
                  key={x.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/app/desk/${x.id}`}
                    className="flex items-start gap-3 rounded-md border border-line p-3 hover:bg-surface-2"
                  >
                    <Icon name="desk" size={18} className="mt-1 shrink-0 text-warn" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{x.subject}</span>
                      <span className="text-sm text-fg-muted">
                        {x.farmer.name} · {t(`desk.cat.${x.category}`)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone="warn">{t('officer.waiting', { t: ago(x.createdAt) })}</Badge>
                      <span className="text-sm font-semibold text-primary">{t('officer.answer')}</span>
                    </span>
                  </Link>
                </m.li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('officer.issues')} sub={t('officer.issuesSub', { n: days })}>
          <ChartFrame
            label={t('officer.issues')}
            chart={
              <HBars
                max={Math.max(1, ...s.categories.map((c) => c.count))}
                data={s.categories.map((c) => ({
                  id: c.category,
                  label: t(`desk.cat.${c.category}`),
                  value: c.count,
                }))}
              />
            }
            table={
              <DataTable
                head={[t('desk.category'), t('officer.count')]}
                numeric={[1]}
                rows={s.categories.map((c) => [t(`desk.cat.${c.category}`), c.count])}
              />
            }
          />
        </Card>
        <Card title={t('officer.weekly')} sub={t('officer.weeklySub')}>
          <ChartFrame
            label={t('officer.weekly')}
            legend={
              <Legend
                items={[
                  { label: t('officer.asked'), color: SERIES[1] },
                  { label: t('officer.answered'), color: SERIES[0] },
                ]}
              />
            }
            chart={
              <Lines
                linear
                height={220}
                xLabels={s.weekly.map((w) => date(w.weekStart))}
                series={[
                  { label: t('officer.asked'), values: s.weekly.map((w) => w.opened), color: SERIES[1] },
                  { label: t('officer.answered'), values: s.weekly.map((w) => w.answered), color: SERIES[0] },
                ]}
              />
            }
            table={
              <DataTable
                head={[t('officer.week'), t('officer.asked'), t('officer.answered')]}
                numeric={[1, 2]}
                rows={s.weekly.map((w) => [date(w.weekStart), w.opened, w.answered])}
              />
            }
          />
        </Card>
        <Card title={t('officer.topPests')} sub={t('officer.topPestsSub', { n: days })}>
          {!s.topPests.length ? (
            <Empty>{t('officer.noPests')}</Empty>
          ) : (
            <ChartFrame
              label={t('officer.topPests')}
              chart={
                <HBars
                  max={Math.max(1, ...s.topPests.map((p) => p.count))}
                  onSelect={setPestId}
                  data={s.topPests.map((p) => ({
                    id: p.pestId,
                    label: pestName(p.pestId),
                    value: p.count,
                    active: p.pestId === pestId,
                  }))}
                />
              }
              table={
                <DataTable
                  head={[t('officer.pest'), t('officer.count')]}
                  numeric={[1]}
                  rows={s.topPests.map((p) => [pestName(p.pestId), p.count])}
                />
              }
            />
          )}
        </Card>
        <Card title={t('officer.crops')} sub={t('officer.cropsSub')}>
          <ChartFrame
            label={t('officer.crops')}
            chart={
              <HBars
                max={Math.max(1, ...s.crops.map((c) => c.farms))}
                data={s.crops.map((c) => ({
                  id: c.cropId,
                  label: `${short(ref.data!.crops.find((x) => x.id === c.cropId)?.n)}`,
                  value: c.farms,
                }))}
              />
            }
            table={
              <DataTable
                head={[t('crop', { ns: 'common' }), t('officer.fields')]}
                numeric={[1]}
                rows={s.crops.map((c) => [cropName(c.cropId), c.farms])}
              />
            }
          />
        </Card>
      </div>
    </div>
  );
}
