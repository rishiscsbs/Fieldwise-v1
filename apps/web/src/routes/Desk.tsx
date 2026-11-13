// Advisory desk: questions read as a chat (avatars, bubbles, a composer), and every message leaves as a paper
// plane. Farmers ask with the Specular "Send question"; officers broadcast with the Specular "Send alert".
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useAuth } from '../stores/auth';
import { useSay } from '../stores/page';
import { toast } from '../stores/toast';
import { useActiveFarm } from '../lib/farm';
import { useFmt } from '../lib/format';
import { shrinkPhoto } from '../lib/image';
import { flyPlane } from '../lib/effects';
import { ApiError } from '../lib/api';
import {
  useAlerts,
  useCreateTicket,
  useReference,
  useSendAlert,
  useSendMessage,
  useSetTicketStatus,
  useTicket,
  useTickets,
  useUpload,
} from '../lib/queries';
import type { TicketDto, UploadDto } from '../lib/api-types';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/signature/PrimaryAction';
import { Kpi } from '../components/Kpi';
import {
  Badge,
  Callout,
  Card,
  Empty,
  Field,
  PageHeader,
  PageSkeleton,
  Skeleton,
  inputClass,
} from '../components/ui';

const STATUS_TONE = { open: 'warn', answered: 'good', closed: 'info' } as const;
const CATEGORIES = ['pest', 'disease', 'nutrient', 'water', 'market', 'other'] as const;

/** Initials in a circle: farmers in the season's primary colour, staff in the accent. */
function Avatar({ name, staff }: { name: string; staff: boolean }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${staff ? 'bg-accent text-ink' : 'bg-primary text-primary-ink'}`}
    >
      {initials}
    </span>
  );
}

function StatusBadge({ status }: { status: TicketDto['status'] }) {
  const { t } = useFmt();
  return <Badge tone={STATUS_TONE[status]}>{t(`desk.status.${status}`)}</Badge>;
}

/** Picks photos, shrinks and uploads them straight away, and shows removable thumbnails. */
function PhotoPicker({ photos, setPhotos }: { photos: UploadDto[]; setPhotos: (p: UploadDto[]) => void }) {
  const { t } = useFmt();
  const upload = useUpload();
  const add = async (files: FileList | null) => {
    const out = [...photos];
    for (const f of Array.from(files ?? []).slice(0, 4 - photos.length)) {
      try {
        out.push(await upload.mutateAsync(await shrinkPhoto(f)));
      } catch (e) {
        toast({ tone: 'bad', title: e instanceof ApiError ? e.message : t('toast.error') });
      }
    }
    setPhotos(out);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((p) => (
        <span key={p.id} className="relative">
          <img src={p.url} alt="" className="h-16 w-16 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}
            className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-surface shadow-2"
            aria-label={t('desk.removePhoto')}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      {photos.length < 4 && (
        <label className="btn-secondary cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-focus">
          {upload.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon name="camera" size={18} />
          )}
          {t('desk.attach')}
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="sr-only"
            onChange={(e) => void add(e.target.files)}
          />
        </label>
      )}
    </div>
  );
}

function AskForm({ onDone }: { onDone: (id: string) => void }) {
  const { t, label } = useFmt();
  const [params] = useSearchParams();
  const { farm } = useActiveFarm();
  const ref = useReference();
  const create = useCreateTicket();
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>(
    params.get('crop') ? 'pest' : 'other',
  );
  const [crop, setCrop] = useState(params.get('crop') ?? farm?.crop ?? '');
  const [photos, setPhotos] = useState<UploadDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const btn = e.currentTarget.querySelector('button[type=submit]');
    try {
      const tk = await create.mutateAsync({
        body,
        category,
        crop: crop || null,
        farmId: farm?.id ?? null,
        uploadIds: photos.map((p) => p.id),
      });
      flyPlane(btn);
      toast({ tone: 'good', title: t('sent', { ns: 'common' }) });
      setBody('');
      setPhotos([]);
      onDone(tk.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('toast.error'));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Callout tone="bad" title={error} />}
      <Field label={t('question', { ns: 'common' })} htmlFor="ask-body">
        <textarea
          id="ask-body"
          required
          minLength={5}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${inputClass} py-2`}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('desk.category')} htmlFor="ask-cat">
          <select
            id="ask-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`desk.cat.${c}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('crop', { ns: 'common' })} htmlFor="ask-crop">
          <select id="ask-crop" value={crop} onChange={(e) => setCrop(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {ref.data?.crops.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c.n)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      <PrimaryAction type="submit" busy={create.isPending} className="self-start">
        <Icon name="send" size={18} />
        {t('send', { ns: 'common' })}
      </PrimaryAction>
    </form>
  );
}

function AlertForm() {
  const { t, label } = useFmt();
  const ref = useReference();
  const send = useSendAlert();
  const [en, setEn] = useState('');
  const [hi, setHi] = useState('');
  const [level, setLevel] = useState<'info' | 'warn' | 'bad'>('warn');
  const [crop, setCrop] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector('button[type=submit]');
    try {
      await send.mutateAsync({ labels: hi.trim() ? { en, hi } : { en }, level, cropId: crop || null });
      flyPlane(btn);
      toast({ tone: 'good', title: t('alertSent', { ns: 'common' }) });
      setEn('');
      setHi('');
    } catch (err) {
      toast({ tone: 'bad', title: err instanceof ApiError ? err.message : t('toast.error') });
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="English" htmlFor="al-en">
        <textarea
          id="al-en"
          required
          minLength={5}
          rows={3}
          value={en}
          onChange={(e) => setEn(e.target.value)}
          placeholder={t('alertPh', { ns: 'common', lng: 'en' })}
          className={`${inputClass} py-2`}
        />
      </Field>
      <Field label="हिन्दी" htmlFor="al-hi">
        <textarea
          id="al-hi"
          rows={3}
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          placeholder={t('alertPh', { ns: 'common', lng: 'hi' })}
          className={`${inputClass} py-2`}
          lang="hi"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('desk.level.label')} htmlFor="al-level">
          <select
            id="al-level"
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
            className={inputClass}
          >
            <option value="info">{t('desk.level.info')}</option>
            <option value="warn">{t('desk.level.warn')}</option>
            <option value="bad">{t('desk.level.bad')}</option>
          </select>
        </Field>
        <Field label={t('crop', { ns: 'common' })} htmlFor="al-crop">
          <select id="al-crop" value={crop} onChange={(e) => setCrop(e.target.value)} className={inputClass}>
            <option value="">—</option>
            {ref.data?.crops.map((c) => (
              <option key={c.id} value={c.id}>
                {label(c.n)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <PrimaryAction type="submit" busy={send.isPending} className="self-start">
        <Icon name="alert" size={18} />
        {t('sendAlert', { ns: 'common' })}
      </PrimaryAction>
    </form>
  );
}

function Thread({ id }: { id: string }) {
  const { t, label, time } = useFmt();
  const user = useAuth((s) => s.user)!;
  const ref = useReference();
  const q = useTicket(id);
  const send = useSendMessage(id);
  const setStatus = useSetTicketStatus(id);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<UploadDto[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [q.data?.messages.length]);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <Empty>{t('loadError')}</Empty>;
  const tk = q.data;
  const isStaff = user.role !== 'farmer';
  const crop = ref.data?.crops.find((c) => c.id === tk.crop);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!body.trim()) return;
    flyPlane(e.currentTarget.querySelector('button[type=submit]'));
    send.mutate({ body, uploadIds: photos.map((p) => p.id) });
    setBody('');
    setPhotos([]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{tk.subject}</h2>
          <p className="text-sm text-fg-muted">
            {tk.farmer.name} · {t(`desk.cat.${tk.category}`)}
            {crop && ` · ${crop.e} ${label(crop.n)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={tk.status} />
          {tk.status !== 'closed' ? (
            <Button
              variant="quiet"
              onClick={() =>
                setStatus.mutate('closed', {
                  onSuccess: () => toast({ tone: 'info', title: t('desk.closed') }),
                })
              }
            >
              {t('desk.close')}
            </Button>
          ) : (
            isStaff && (
              <Button variant="quiet" onClick={() => setStatus.mutate('open')}>
                {t('desk.reopen')}
              </Button>
            )
          )}
        </div>
      </div>

      <ol
        className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-xl bg-surface-2 p-3 sm:p-4"
        aria-label={t('desk.conversation')}
      >
        <AnimatePresence initial={false}>
          {tk.messages.map((msg) => {
            const mine = msg.author.id === user.id;
            return (
              <m.li
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: msg.id.startsWith('temp-') ? 0.7 : 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className={`flex max-w-[88%] items-end gap-2 ${mine ? 'flex-row-reverse self-end' : 'self-start'}`}
              >
                <Avatar name={msg.author.name || '?'} staff={msg.author.role !== 'farmer'} />
                <div
                  className={`min-w-0 rounded-2xl p-3 shadow-1 ${mine ? 'rounded-br-md bg-primary text-primary-ink' : 'rounded-bl-md border border-line bg-surface'}`}
                >
                  <p className={`mb-1 text-xs font-semibold ${mine ? '' : 'text-fg-muted'}`}>
                    {mine ? t('desk.you') : msg.author.name} · {t(`role.${msg.author.role}`)}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  {msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((a) => (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                          <img
                            src={a.url}
                            alt=""
                            className="h-24 w-24 rounded-md object-cover"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <time
                    className={`mt-1 block text-right text-xs ${mine ? '' : 'text-fg-muted'}`}
                    dateTime={msg.createdAt}
                  >
                    {time(msg.createdAt)}
                  </time>
                </div>
              </m.li>
            );
          })}
        </AnimatePresence>
        <div ref={end} />
      </ol>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="reply" className="sr-only">
          {t('desk.composer')}
        </label>
        <textarea
          id="reply"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter sends, like most chat apps; plain Enter keeps a new line for longer answers.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder={t('replyPh', { ns: 'common' })}
          className={`${inputClass} rounded-2xl px-4 py-3`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PhotoPicker photos={photos} setPhotos={setPhotos} />
          <Button type="submit" variant="primary" disabled={!body.trim()}>
            <Icon name="send" size={18} />
            {t('replyB', { ns: 'common' })}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Desk() {
  const { t, label, time } = useFmt();
  const { ticketId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const tickets = useTickets();
  const alerts = useAlerts();
  const [filter, setFilter] = useState<'all' | TicketDto['status']>('all');
  const isStaff = user.role !== 'farmer';
  const asking = params.get('ask') === '1';

  useSay(t(isStaff ? 'ps_desk' : 'expert_sub', { ns: 'common' }));

  const list = (tickets.data ?? []).filter((x) => filter === 'all' || x.status === filter);
  const counts = { open: 0, answered: 0, closed: 0 };
  for (const x of tickets.data ?? []) counts[x.status]++;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isStaff ? t('pt_desk', { ns: 'common' }) : t('expert_lead', { ns: 'common' })}
        sub={isStaff ? t('ps_desk', { ns: 'common' }) : t('expert_sub', { ns: 'common' })}
        actions={
          !isStaff &&
          !asking && (
            <Button variant="primary" magnetic onClick={() => setParams({ ask: '1' })}>
              <Icon name="plus" size={18} />
              {t('desk.ask')}
            </Button>
          )
        }
      />

      {isStaff && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {(['open', 'answered', 'closed'] as const).map((s, i) => (
            <Kpi
              key={s}
              index={i}
              icon={s === 'open' ? 'desk' : s === 'answered' ? 'check' : 'close'}
              label={t(`desk.status.${s}`)}
              value={counts[s]}
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={`flex min-w-0 flex-col gap-4 ${ticketId ? 'hidden lg:flex' : ''}`}>
          {!isStaff && asking && (
            <Card
              title={t('desk.ask')}
              actions={
                <Button variant="quiet" onClick={() => setParams({})}>
                  {t('notif.close')}
                </Button>
              }
            >
              <AskForm onDone={(id) => navigate(`/app/desk/${id}`)} />
            </Card>
          )}
          {isStaff && (
            <Card title={t('broadcast', { ns: 'common' })}>
              <AlertForm />
            </Card>
          )}
          <Card
            title={t('myQ', { ns: 'common' })}
            actions={
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">{t('status', { ns: 'common' })}</span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="min-h-11 rounded-md border border-line bg-surface px-2"
                >
                  <option value="all">{t('total', { ns: 'common' })}</option>
                  {(['open', 'answered', 'closed'] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`desk.status.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            {tickets.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !list.length ? (
              <Empty>{t('noQ', { ns: 'common' })}</Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {list.map((x) => (
                  <li key={x.id}>
                    <Link
                      to={`/app/desk/${x.id}`}
                      aria-current={x.id === ticketId ? 'page' : undefined}
                      className={`flex items-start gap-3 rounded-md p-3 hover:bg-surface-2 ${x.id === ticketId ? 'bg-surface-2' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{x.subject}</span>
                        <span className="text-xs text-fg-muted">
                          {isStaff ? `${x.farmer.name} · ` : ''}
                          {time(x.updatedAt)} · {x.messageCount}
                        </span>
                      </span>
                      <StatusBadge status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className={`min-w-0 ${ticketId ? '' : 'hidden lg:block'}`}>
          <Card>
            {ticketId ? (
              <>
                <Link to="/app/desk" className="btn-quiet mb-2 lg:hidden">
                  <Icon name="arrowLeft" size={16} />
                  {t('desk.back')}
                </Link>
                <Thread id={ticketId} />
              </>
            ) : (
              <Empty>{t('desk.empty')}</Empty>
            )}
          </Card>
        </div>
      </div>

      <Card title={isStaff ? t('alertsT', { ns: 'common' }) : t('desk.alertsFor')}>
        {alerts.isLoading ? (
          <PageSkeleton cards={1} />
        ) : !alerts.data?.length ? (
          <Empty>{t('noAlerts', { ns: 'common' })}</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {alerts.data.slice(0, 6).map((a) => (
              <li key={a.id}>
                <Callout tone={a.level === 'bad' ? 'bad' : a.level === 'warn' ? 'warn' : 'info'}>
                  <p className="text-base">{label(a.labels)}</p>
                  <time className="text-xs text-fg-muted" dateTime={a.createdAt}>
                    {time(a.createdAt)} · {a.author.name}
                  </time>
                </Callout>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
