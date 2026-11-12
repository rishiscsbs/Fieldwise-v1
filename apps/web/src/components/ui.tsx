// Small building blocks used on every screen.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';

type Tone = 'good' | 'warn' | 'bad' | 'info';
const TONE_ICON: Record<Tone, IconName> = { good: 'check', warn: 'alert', bad: 'x', info: 'info' };
const TONE_CLASS: Record<Tone, string> = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
};
const TONE_BORDER: Record<Tone, string> = {
  good: 'border-good',
  warn: 'border-warn',
  bad: 'border-bad',
  info: 'border-info',
};

export function Card({
  title,
  sub,
  actions,
  children,
  className = '',
  id,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`card min-w-0 ${className}`} aria-labelledby={title && id ? `${id}-h` : undefined}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 id={id ? `${id}-h` : undefined} className="text-xl font-semibold">
                {title}
              </h2>
            )}
            {sub && <p className="text-sm text-fg-muted">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** A status badge. Always icon + text, never colour alone. */
export function Badge({ tone, children, icon = true }: { tone: Tone; children: ReactNode; icon?: boolean }) {
  return (
    <span className={`badge ${TONE_CLASS[tone]}`}>
      {icon && <Icon name={TONE_ICON[tone]} size={14} />}
      {children}
    </span>
  );
}

export function Callout({ tone, children, title }: { tone: Tone; children?: ReactNode; title?: ReactNode }) {
  return (
    <div
      role={tone === 'bad' || tone === 'warn' ? 'alert' : undefined}
      className={`flex gap-3 rounded-md border-l-4 p-3 ${TONE_BORDER[tone]} ${TONE_CLASS[tone].split(' ')[0]}`}
    >
      <span className={TONE_CLASS[tone].split(' ')[1]}>
        <Icon name={TONE_ICON[tone]} size={20} />
      </span>
      <div className="min-w-0 text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}

/** Says where data came from. Simulated data is always labelled. */
export function SourceBadge({ simulated, label }: { simulated: boolean; label: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm text-fg-muted">
      <span
        className={`badge ${simulated ? 'border border-line bg-surface-2 text-fg-muted' : 'bg-good-soft text-good'}`}
      >
        <Icon name={simulated ? 'info' : 'check'} size={14} />
        {simulated ? t('simulated') : t('live')}
      </span>
      {label}
    </span>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

/** Placeholder for a loading page: shaped like cards, announced to screen readers once. */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="card space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="card flex flex-col items-start gap-3">
      <Callout tone="bad" title={t('loadError')} />
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-fg placeholder:text-fg-muted focus-visible:border-focus';

/** Soil test level as a badge: low is a problem, high is fine, medium is a watch. */
export function LevelBadge({ level }: { level: 'low' | 'med' | 'high' }) {
  const { t } = useTranslation('common');
  return <Badge tone={level === 'low' ? 'bad' : level === 'high' ? 'good' : 'warn'}>{t(level)}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-surface-2 p-4 text-center text-sm text-fg-muted">{children}</p>;
}

/** Page title (display face) with the subtitle from the legacy pt_/ps_ strings and optional actions. */
export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-fg-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A 0–100 score as a thin bar with the number beside it. */
export function ScoreBar({
  value,
  tone = 'primary',
}: {
  value: number;
  tone?: 'primary' | 'accent' | 'bad';
}) {
  const fill = tone === 'accent' ? 'bg-accent' : tone === 'bad' ? 'bg-bad' : 'bg-primary';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          className={`h-full rounded-full ${fill} transition-[width] duration-4 ease-out`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="num w-10 text-right text-sm font-semibold">{value}</span>
    </div>
  );
}
