// Shared chart plumbing: container sizing, the chart/table switch, legend and tooltip.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'] as const;

/** Width of an element, kept up to date with ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Lets the reader switch between the chart and an accessible table of the same numbers. */
export function ChartFrame({
  chart,
  table,
  legend,
  label,
}: {
  chart: ReactNode;
  table: ReactNode;
  legend?: ReactNode;
  label: string;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{legend}</div>
        <div
          role="group"
          aria-label={`${t('view.label')}: ${label}`}
          className="inline-flex rounded-md border border-line p-0.5"
        >
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`inline-flex min-h-9 items-center gap-1 rounded-sm px-2 text-sm font-semibold ${view === v ? 'bg-surface-2 text-fg' : 'text-fg-muted'}`}
            >
              <Icon name={v} size={16} />
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? (
        <div role="img" aria-label={label}>
          {chart}
        </div>
      ) : (
        <div className="relative overflow-x-auto">{table}</div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="15"
              y2="4"
              stroke={i.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={i.dashed ? '3 3' : undefined}
            />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export interface TipRow {
  label: string;
  value: string;
  color?: string;
}

/** Hover readout. Values lead, labels follow; text uses ink tokens, the colour lives in the key stroke. */
export function Tooltip({
  x,
  y,
  title,
  rows,
  width,
}: {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
  width: number;
}) {
  const left = Math.min(Math.max(8, x + 12), Math.max(8, width - 190));
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-md border border-line bg-surface p-2 text-sm shadow-2"
      style={{ left, top: Math.max(0, y - 10) }}
    >
      <div className="mb-1 text-xs text-fg-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && (
            <svg width="12" height="6" aria-hidden="true">
              <line x1="1" y1="3" x2="11" y2="3" stroke={r.color} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          <b className="num">{r.value}</b>
          <span className="text-fg-muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A plain data table for the table view. */
export function DataTable({
  head,
  rows,
  numeric = [],
}: {
  head: string[];
  rows: (string | number)[][];
  numeric?: number[];
}) {
  return (
    <table className="w-full min-w-max border-collapse text-sm">
      <thead>
        <tr className="border-b border-line text-left text-fg-muted">
          {head.map((h, i) => (
            <th
              key={h}
              scope="col"
              className={`px-2 py-1.5 font-semibold ${numeric.includes(i) ? 'text-right' : ''}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-b border-line last:border-0">
            {r.map((c, ci) =>
              ci === 0 ? (
                <th key={ci} scope="row" className="px-2 py-1.5 text-left font-normal">
                  {c}
                </th>
              ) : (
                <td key={ci} className={`num px-2 py-1.5 ${numeric.includes(ci) ? 'text-right' : ''}`}>
                  {c}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Clean, compact tick labels: 0 / 500 / 1K / 1.5K. */
export const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(Math.round(n * 10) / 10);
