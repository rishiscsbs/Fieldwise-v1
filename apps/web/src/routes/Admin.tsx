import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import { useAuth } from '../stores/auth';
import { useSay } from '../stores/page';
import { toast } from '../stores/toast';
import { useFmt } from '../lib/format';
import { ApiError } from '../lib/api';
import {
  useAdminCrops,
  useAdminDistricts,
  useAdminMutation,
  useAdminOverview,
  useAdminUsers,
  useReference,
} from '../lib/queries';
import type { AdminCropDto, AdminDistrictDto, AdminUserDto } from '../lib/api-types';
import { ChartFrame, DataTable } from '../charts/frame';
import { IndiaMap } from '../maps/IndiaMap';
import { Button } from '../components/Button';
import { Toggle } from '../components/Toggle';
import {
  Badge,
  Callout,
  Card,
  Empty,
  ErrorState,
  Field,
  PageHeader,
  PageSkeleton,
  inputClass,
} from '../components/ui';

const TABS = ['overview', 'users', 'districts', 'crops'] as const;
type Tab = (typeof TABS)[number];
const ROLES = ['farmer', 'officer', 'admin'] as const;
const small = `${inputClass} min-h-10 text-sm`;
// Filter selects size to their content so they sit beside the search box.
const filterClass = inputClass.replace('w-full', 'w-auto');

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function Overview() {
  const { t, label, num } = useFmt();
  const navigate = useNavigate();
  const o = useAdminOverview();
  if (o.isError) return <ErrorState onRetry={() => void o.refetch()} />;
  if (!o.data) return <PageSkeleton cards={2} />;
  const maxFarmers = Math.max(1, ...o.data.districts.map((d) => d.farmers));
  const rows = o.data.districts.map((d) => [
    label(d.labels),
    d.farmers,
    d.farms,
    d.officers,
    d.openTickets,
    d.pestReports,
  ]);
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3">
        {ROLES.map((r) => (
          <div key={r} className="card py-3">
            <dt className="text-sm text-fg-muted">{t(`role.${r}`)}</dt>
            <dd className="num font-display text-3xl">{num(o.data!.users[r])}</dd>
          </div>
        ))}
      </dl>
      <Card title={t('admin.map')} sub={t('admin.mapSub')}>
        <ChartFrame
          label={t('admin.map')}
          chart={
            <IndiaMap
              label={t('admin.map')}
              maxHeight={560}
              onSelect={(id) => navigate(`/app/officer?district=${id}`)}
              pins={o.data.districts.map((d) => ({
                id: d.id,
                lat: d.lat,
                lon: d.lon,
                label: label(d.labels).split(',')[0]!,
                r: 5 + (d.farmers / maxFarmers) * 7,
                highlight: d.openTickets > 0,
                detail: [
                  { label: t('admin.farmers'), value: String(d.farmers) },
                  { label: t('admin.openTickets'), value: String(d.openTickets) },
                  { label: t('admin.pests'), value: String(d.pestReports) },
                ],
              }))}
            />
          }
          table={
            <DataTable
              head={[
                t('officer.district'),
                t('admin.farmers'),
                t('admin.fields'),
                t('admin.officers'),
                t('admin.openTickets'),
                t('admin.pests'),
              ]}
              numeric={[1, 2, 3, 4, 5]}
              rows={rows}
            />
          }
        />
      </Card>
    </div>
  );
}

function UserRow({ u, districts }: { u: AdminUserDto; districts: AdminDistrictDto[] }) {
  const { t, label } = useFmt();
  const me = useAuth((s) => s.user)!;
  const patch = useAdminMutation<Partial<AdminUserDto>, AdminUserDto>(
    () => `/admin/users/${u.id}`,
    'PATCH',
    (b) => b,
  );
  const save = (b: Partial<AdminUserDto>) =>
    patch.mutate(b, {
      onSuccess: () => toast({ tone: 'good', title: t('admin.saved') }),
      onError: (e) => toast({ tone: 'bad', title: errorText(e, t('toast.error')) }),
    });
  const self = u.id === me.id;
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="py-2 pr-2 text-left">
        <span className="block font-semibold">{u.name || '—'}</span>
        <span className="num text-xs text-fg-muted">{u.phone}</span>
      </th>
      <td className="px-2 py-2">
        <select
          aria-label={`${t('admin.role')}: ${u.name}`}
          value={u.role}
          disabled={self}
          onChange={(e) => save({ role: e.target.value as AdminUserDto['role'] })}
          className={small}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          aria-label={`${t('officer.district')}: ${u.name}`}
          value={u.districtId ?? ''}
          onChange={(e) => save({ districtId: e.target.value || null })}
          className={small}
        >
          <option value="">—</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {label(d.labels).split(',')[0]}
            </option>
          ))}
        </select>
      </td>
      <td className="num px-2 py-2 text-right">{u.farms}</td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <Toggle
            checked={u.active}
            onChange={(v) => !self && save({ active: v })}
            label={`${u.active ? t('admin.turnOff') : t('admin.turnOn')}: ${u.name}`}
          />
          {!u.active && <Badge tone="info">{t('admin.inactive')}</Badge>}
        </div>
      </td>
    </tr>
  );
}

function Users() {
  const { t, label } = useFmt();
  const districts = useAdminDistricts();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [districtId, setDistrictId] = useState('');
  const users = useAdminUsers({
    q: query || undefined,
    role: role || undefined,
    districtId: districtId || undefined,
  });
  const [draft, setDraft] = useState({ phone: '', name: '', role: 'officer', districtId: '' });
  const create = useAdminMutation<typeof draft, AdminUserDto>(
    () => '/admin/users',
    'POST',
    (b) => ({ ...b, districtId: b.districtId || null }),
  );

  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(draft, {
      onSuccess: () => {
        toast({ tone: 'good', title: t('admin.saved') });
        setDraft({ phone: '', name: '', role: 'officer', districtId: '' });
      },
      onError: (err) => toast({ tone: 'bad', title: errorText(err, t('toast.error')) }),
    });
  };

  const ds = districts.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <Card title={t('admin.add')}>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Field label={t('admin.phone')} htmlFor="nu-phone">
            <input
              id="nu-phone"
              required
              type="tel"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t('admin.name')} htmlFor="nu-name">
            <input
              id="nu-name"
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t('admin.role')} htmlFor="nu-role">
            <select
              id="nu-role"
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('officer.district')} htmlFor="nu-district">
            <select
              id="nu-district"
              value={draft.districtId}
              onChange={(e) => setDraft({ ...draft, districtId: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {ds.map((d) => (
                <option key={d.id} value={d.id}>
                  {label(d.labels)}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="primary" busy={create.isPending}>
            {t('admin.add')}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="min-w-48 flex-1">
            <label htmlFor="u-q" className="sr-only">
              {t('admin.search')}
            </label>
            <input
              id="u-q"
              type="search"
              placeholder={t('admin.search')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={inputClass}
            />
          </div>
          <label className="sr-only" htmlFor="u-role">
            {t('admin.role')}
          </label>
          <select id="u-role" value={role} onChange={(e) => setRole(e.target.value)} className={filterClass}>
            <option value="">{t('admin.allRoles')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}`)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="u-district">
            {t('officer.district')}
          </label>
          <select
            id="u-district"
            value={districtId}
            onChange={(e) => setDistrictId(e.target.value)}
            className={filterClass}
          >
            <option value="">{t('admin.allDistricts')}</option>
            {ds.map((d) => (
              <option key={d.id} value={d.id}>
                {label(d.labels).split(',')[0]}
              </option>
            ))}
          </select>
        </div>
        {users.isLoading ? (
          <PageSkeleton cards={1} />
        ) : !users.data?.length ? (
          <Empty>{t('admin.none')}</Empty>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-line text-left text-fg-muted">
                  <th scope="col" className="py-2 pr-2">
                    {t('admin.name')}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t('admin.role')}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t('officer.district')}
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    {t('admin.fields')}
                  </th>
                  <th scope="col" className="px-2 py-2">
                    {t('admin.active')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <UserRow key={u.id} u={u} districts={ds} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DistrictEditor({ d }: { d: AdminDistrictDto }) {
  const { t, label } = useFmt();
  const ref = useReference();
  const [f, setF] = useState({
    en: d.labels.en,
    hi: d.labels.hi ?? '',
    rainMm: d.rainMm,
    ...d.temp,
    soil: d.soil,
    ph: d.ph,
    markets: d.markets.join(', '),
  });
  const patch = useAdminMutation<object, AdminDistrictDto>(
    () => `/admin/districts/${d.id}`,
    'PATCH',
    (b) => b,
  );
  const save = (e: FormEvent) => {
    e.preventDefault();
    patch.mutate(
      {
        labels: f.hi ? { en: f.en, hi: f.hi } : { en: f.en },
        rainMm: f.rainMm,
        temp: { kharif: f.kharif, rabi: f.rabi, zaid: f.zaid },
        soil: f.soil,
        ph: f.ph,
        markets: f.markets
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => toast({ tone: 'good', title: t('admin.saved') }),
        onError: (err) => toast({ tone: 'bad', title: errorText(err, t('toast.error')) }),
      },
    );
  };
  const num = (k: 'rainMm' | 'kharif' | 'rabi' | 'zaid' | 'ph', lab: string, step = 1) => (
    <Field label={lab} htmlFor={`${d.id}-${k}`}>
      <input
        id={`${d.id}-${k}`}
        type="number"
        step={step}
        required
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })}
        className={`${small} num`}
      />
    </Field>
  );
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label={t('admin.nameEn')} htmlFor={`${d.id}-en`}>
        <input
          id={`${d.id}-en`}
          required
          value={f.en}
          onChange={(e) => setF({ ...f, en: e.target.value })}
          className={small}
        />
      </Field>
      <Field label={t('admin.nameHi')} htmlFor={`${d.id}-hi`}>
        <input
          id={`${d.id}-hi`}
          lang="hi"
          value={f.hi}
          onChange={(e) => setF({ ...f, hi: e.target.value })}
          className={small}
        />
      </Field>
      <Field label={t('soil', { ns: 'common' })} htmlFor={`${d.id}-soil`}>
        <select
          id={`${d.id}-soil`}
          value={f.soil}
          onChange={(e) => setF({ ...f, soil: e.target.value })}
          className={small}
        >
          {ref.data?.soils.map((s) => (
            <option key={s.id} value={s.id}>
              {label(s.labels)}
            </option>
          ))}
        </select>
      </Field>
      {num('ph', t('ph', { ns: 'common' }), 0.1)}
      {num('rainMm', t('admin.rain'))}
      {num('kharif', t('admin.tempK'), 0.5)}
      {num('rabi', t('admin.tempR'), 0.5)}
      {num('zaid', t('admin.tempZ'), 0.5)}
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label={t('admin.markets')} htmlFor={`${d.id}-mk`}>
          <input
            id={`${d.id}-mk`}
            required
            value={f.markets}
            onChange={(e) => setF({ ...f, markets: e.target.value })}
            className={small}
          />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="primary" busy={patch.isPending}>
          {t('admin.save')}
        </Button>
      </div>
    </form>
  );
}

function Districts() {
  const { label } = useFmt();
  const ds = useAdminDistricts();
  if (ds.isError) return <ErrorState onRetry={() => void ds.refetch()} />;
  if (!ds.data) return <PageSkeleton cards={2} />;
  return (
    <div className="flex flex-col gap-3">
      {ds.data.map((d) => (
        <details key={d.id} className="card group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
            <span>{label(d.labels)}</span>
            <span className="num text-sm font-normal text-fg-muted">
              {d.markets.length} · pH {d.ph} · {d.rainMm} mm
            </span>
          </summary>
          <div className="mt-4">
            <DistrictEditor d={d} />
          </div>
        </details>
      ))}
    </div>
  );
}

function CropRow({ c }: { c: AdminCropDto }) {
  const { t, label } = useFmt();
  const [f, setF] = useState({ msp: c.msp ?? '', p: c.p, y: c.y });
  const patch = useAdminMutation<object, AdminCropDto>(
    () => `/admin/crops/${c.id}`,
    'PATCH',
    (b) => b,
  );
  const dirty = String(f.msp) !== String(c.msp ?? '') || f.p !== c.p || f.y !== c.y;
  const save = (b: object) =>
    patch.mutate(b, {
      onSuccess: () => toast({ tone: 'good', title: t('admin.saved') }),
      onError: (err) => toast({ tone: 'bad', title: errorText(err, t('toast.error')) }),
    });
  return (
    <tr className={`border-b border-line last:border-0 ${c.active ? '' : 'opacity-60'}`}>
      <th scope="row" className="py-2 pr-2 text-left font-semibold">
        <span aria-hidden="true">{c.e}</span> {label(c.n)}
      </th>
      {(
        [
          ['msp', t('admin.msp')],
          ['p', t('admin.price')],
          ['y', t('admin.yield')],
        ] as const
      ).map(([k, lab]) => (
        <td key={k} className="px-2 py-2">
          <input
            aria-label={`${lab}: ${label(c.n)}`}
            type="number"
            min={0}
            step={k === 'y' ? 0.5 : 1}
            placeholder={k === 'msp' ? t('admin.noMsp') : undefined}
            value={f[k]}
            onChange={(e) =>
              setF({ ...f, [k]: k === 'msp' && e.target.value === '' ? '' : Number(e.target.value) })
            }
            className={`${small} num w-28 text-right`}
          />
        </td>
      ))}
      <td className="px-2 py-2">
        <Toggle
          checked={c.active}
          onChange={(v) => save({ active: v })}
          label={`${c.active ? t('admin.turnOff') : t('admin.turnOn')}: ${label(c.n)}`}
        />
      </td>
      <td className="py-2 pl-2">
        <Button
          variant={dirty ? 'primary' : 'quiet'}
          disabled={!dirty}
          busy={patch.isPending}
          onClick={() => save({ msp: f.msp === '' ? null : Number(f.msp), p: f.p, y: f.y })}
        >
          {t('admin.save')}
        </Button>
      </td>
    </tr>
  );
}

function Crops() {
  const { t } = useFmt();
  const crops = useAdminCrops();
  if (crops.isError) return <ErrorState onRetry={() => void crops.refetch()} />;
  if (!crops.data) return <PageSkeleton cards={1} />;
  return (
    <Card>
      <div className="mb-4">
        <Callout tone="info" title={t('admin.cropNote')} />
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-line text-left text-fg-muted">
              <th scope="col" className="py-2 pr-2">
                {t('crop', { ns: 'common' })}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.msp')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.price')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.yield')}
              </th>
              <th scope="col" className="px-2 py-2">
                {t('admin.active')}
              </th>
              <th scope="col" className="py-2 pl-2">
                <span className="sr-only">{t('admin.save')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {crops.data.map((c) => (
              <CropRow key={c.id} c={c} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function Admin() {
  const role = useAuth((s) => s.user?.role);
  return role === 'admin' ? <AdminPage /> : <Navigate to="/app" replace />;
}

function AdminPage() {
  const { t } = useFmt();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'overview';
  useSay(`${t('admin.title')}. ${t('admin.sub')}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('admin.title')} sub={t('admin.sub')} />
      <div
        role="tablist"
        aria-label={t('admin.title')}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setParams({ tab: k }, { replace: true })}
            className={`relative min-h-11 shrink-0 px-4 font-semibold ${tab === k ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
          >
            {t(`admin.tabs.${k}`)}
            {tab === k && (
              <m.span
                layoutId="admin-tab"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
              />
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0">
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <Users />}
        {tab === 'districts' && <Districts />}
        {tab === 'crops' && <Crops />}
      </div>
    </div>
  );
}
