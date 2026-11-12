// The chart set. All charts size to their container, animate in once, show a tooltip on hover or focus,
// and have a table view (via ChartFrame in the page). Marks follow the dataviz spec: bars <= 24px with a
// 4px rounded data-end, 2px lines, >= 8px end dots with a surface ring, 1px recessive grid.
import { useState } from 'react';
import { m } from 'framer-motion';
import { scaleBand, scaleLinear, scalePoint } from '@visx/scale';
import { LinePath, AreaClosed } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { SERIES, Tooltip, compact, useWidth, type TipRow } from './frame';

const ease = [0.2, 0.8, 0.2, 1] as const;
const GRID = 'var(--border)';
const INK_MUTED = 'var(--text-muted)';
const INK = 'var(--text)';

/** A bar path with a 4px rounded end at the top and a square base. */
function colPath(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
/** Horizontal bar: square at the left baseline, rounded at the right tip. */
function barPath(x: number, y: number, w: number, h: number, r = 4) {
  if (w <= 0) return '';
  const rr = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
}

// ---------- horizontal bars (crop suitability) ----------

export interface HBarDatum {
  id: string;
  label: string;
  value: number;
  /** Highlight (the chosen crop) */
  active?: boolean;
}

export function HBars({
  data,
  max = 100,
  format = String,
  onSelect,
}: {
  data: HBarDatum[];
  max?: number;
  format?: (n: number) => string;
  onSelect?: (id: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const row = 34;
  const labelW = Math.min(170, Math.max(96, width * 0.34));
  const valueW = 40;
  const h = data.length * row + 8;
  const x = scaleLinear({ domain: [0, max], range: [0, Math.max(10, width - labelW - valueW)] });
  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg width={width} height={h}>
          {[0, 25, 50, 75, 100]
            .filter((v) => v <= max)
            .map((v) => (
              <line
                key={v}
                x1={labelW + x(v)}
                x2={labelW + x(v)}
                y1={0}
                y2={h - 4}
                stroke={GRID}
                strokeWidth={1}
              />
            ))}
          {data.map((d, i) => {
            const y = i * row + 8;
            const bh = Math.min(20, row - 12);
            return (
              <g
                key={d.id}
                tabIndex={0}
                role="button"
                aria-label={`${d.label}: ${format(d.value)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(d.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(d.id)}
                className={onSelect ? 'cursor-pointer outline-none' : 'outline-none'}
              >
                <rect
                  x={0}
                  y={y - 4}
                  width={width}
                  height={row}
                  fill={hover === i ? 'var(--surface-2)' : 'transparent'}
                  rx={6}
                />
                <text
                  x={labelW - 10}
                  y={y + bh / 2}
                  dy="0.35em"
                  textAnchor="end"
                  fontSize={14}
                  fill={INK}
                  fontWeight={d.active ? 700 : 400}
                >
                  {d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label}
                </text>
                <m.path
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.04, ease }}
                  style={{ originX: `${labelW}px` }}
                  d={barPath(labelW, y, x(d.value), bh)}
                  fill={d.active ? 'var(--accent)' : SERIES[0]}
                />
                <text
                  x={labelW + x(d.value) + 6}
                  y={y + bh / 2}
                  dy="0.35em"
                  fontSize={13}
                  fill={INK}
                  className="num"
                  fontWeight={600}
                >
                  {format(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

// ---------- columns (rain per day) ----------

export function Columns({
  data,
  unit,
  color = SERIES[1],
  emptyLabel,
}: {
  data: { label: string; value: number; title: string }[];
  unit: string;
  color?: string;
  /** Shown across the plot when every value is zero (e.g. no rain expected) */
  emptyLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 190;
  const pad = { t: 18, r: 8, b: 26, l: 34 };
  const maxV = Math.max(5, ...data.map((d) => d.value));
  const y = scaleLinear({ domain: [0, maxV], range: [h - pad.b, pad.t], nice: true });
  const x = scaleBand({ domain: data.map((_, i) => String(i)), range: [pad.l, width - pad.r], padding: 0.3 });
  const bw = Math.min(24, x.bandwidth());
  const ticks = y.ticks(3);
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={h}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text
                x={pad.l - 6}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                fontSize={12}
                fill={INK_MUTED}
                className="num"
              >
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = (x(String(i)) ?? 0) + x.bandwidth() / 2;
            const top = y(d.value);
            return (
              <g
                key={i}
                tabIndex={0}
                aria-label={`${d.title}: ${d.value} ${unit}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                <rect
                  x={cx - x.bandwidth() / 2}
                  y={pad.t}
                  width={x.bandwidth()}
                  height={h - pad.b - pad.t}
                  fill={hover === i ? 'var(--surface-2)' : 'transparent'}
                />
                <m.path
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease }}
                  style={{ originY: `${h - pad.b}px` }}
                  d={colPath(cx - bw / 2, top, bw, h - pad.b - top)}
                  fill={color}
                />
                {d.value > 0 && (
                  <text x={cx} y={top - 5} textAnchor="middle" fontSize={12} fill={INK} className="num">
                    {d.value}
                  </text>
                )}
                <text x={cx} y={h - 8} textAnchor="middle" fontSize={12} fill={INK_MUTED}>
                  {d.label}
                </text>
              </g>
            );
          })}
          <line x1={pad.l} x2={width - pad.r} y1={h - pad.b} y2={h - pad.b} stroke={INK_MUTED} />
          {emptyLabel && data.every((d) => d.value === 0) && (
            <text
              x={(pad.l + width - pad.r) / 2}
              y={(pad.t + h - pad.b) / 2}
              textAnchor="middle"
              fontSize={15}
              fill={INK_MUTED}
            >
              {emptyLabel}
            </text>
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip
          x={(x(String(hover)) ?? 0) + x.bandwidth()}
          y={y(data[hover]!.value)}
          width={width}
          title={data[hover]!.title}
          rows={[{ label: unit, value: String(data[hover]!.value), color }]}
        />
      )}
    </div>
  );
}

// ---------- range bars (daily min–max temperature) ----------

export function RangeBars({
  data,
  unit = '°C',
  minLabel,
  maxLabel,
}: {
  data: { label: string; title: string; lo: number; hi: number }[];
  unit?: string;
  minLabel: string;
  maxLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = 210;
  const pad = { t: 22, r: 8, b: 26, l: 34 };
  const lo = Math.min(...data.map((d) => d.lo)) - 2;
  const hi = Math.max(...data.map((d) => d.hi)) + 2;
  const y = scaleLinear({ domain: [lo, hi], range: [h - pad.b, pad.t], nice: true });
  const x = scalePoint({ domain: data.map((_, i) => String(i)), range: [pad.l + 16, width - pad.r - 16] });
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={h}>
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text
                x={pad.l - 6}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                fontSize={12}
                fill={INK_MUTED}
                className="num"
              >
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = x(String(i)) ?? 0;
            return (
              <g
                key={i}
                tabIndex={0}
                aria-label={`${d.title}: ${d.lo}–${d.hi} ${unit}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                <rect
                  x={cx - 18}
                  y={pad.t}
                  width={36}
                  height={h - pad.b - pad.t}
                  fill={hover === i ? 'var(--surface-2)' : 'transparent'}
                  rx={6}
                />
                <m.line
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease }}
                  x1={cx}
                  x2={cx}
                  y1={y(d.lo)}
                  y2={y(d.hi)}
                  stroke={SERIES[2]}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <circle
                  cx={cx}
                  cy={y(d.hi)}
                  r={4.5}
                  fill={SERIES[3]}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <circle
                  cx={cx}
                  cy={y(d.lo)}
                  r={4.5}
                  fill={SERIES[1]}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <text x={cx} y={y(d.hi) - 9} textAnchor="middle" fontSize={12} fill={INK} className="num">
                  {d.hi}°
                </text>
                <text x={cx} y={h - 8} textAnchor="middle" fontSize={12} fill={INK_MUTED}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip
          x={x(String(hover)) ?? 0}
          y={y(data[hover]!.hi)}
          width={width}
          title={data[hover]!.title}
          rows={[
            { label: maxLabel, value: `${data[hover]!.hi}${unit}`, color: SERIES[3] },
            { label: minLabel, value: `${data[hover]!.lo}${unit}`, color: SERIES[1] },
          ]}
        />
      )}
    </div>
  );
}

// ---------- multi-line (mandi prices, soil history) ----------

export interface LineSeries {
  label: string;
  values: number[];
  color: string;
}

export function Lines({
  series,
  xLabels,
  format = (n: number) => String(Math.round(n)),
  reference,
  height = 240,
  area = false,
}: {
  series: LineSeries[];
  xLabels: string[];
  format?: (n: number) => string;
  /** A labelled horizontal reference line, e.g. MSP */
  reference?: { value: number; label: string };
  height?: number;
  area?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const endLabels = series.length <= 4 && width > 480;
  const pad = { t: 14, r: endLabels ? 96 : 10, b: 26, l: 46 };
  const all = series.flatMap((s) => s.values).concat(reference ? [reference.value] : []);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const spread = Math.max(1, max - min);
  const y = scaleLinear({
    domain: [min - spread * 0.08, max + spread * 0.08],
    range: [height - pad.b, pad.t],
    nice: true,
  });
  const x = scaleLinear({ domain: [0, Math.max(1, n - 1)], range: [pad.l, width - pad.r] });
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 90))));

  // End labels sorted top to bottom and nudged apart so they never collide.
  const ends = series
    .map((s) => ({ s, y: y(s.values.at(-1) ?? 0) }))
    .sort((a, b) => a.y - b.y)
    .reduce<{ s: LineSeries; y: number }[]>((acc, e) => {
      const prev = acc.at(-1);
      acc.push({ ...e, y: prev && e.y - prev.y < 16 ? prev.y + 16 : e.y });
      return acc;
    }, []);

  const onMove = (clientX: number, el: SVGElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(x.invert(clientX - r.left));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const rows: TipRow[] =
    hover === null
      ? []
      : series.map((s) => ({ label: s.label, value: format(s.values[hover] ?? 0), color: s.color }));

  return (
    <div ref={ref} className="relative">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          tabIndex={0}
          aria-label={series.map((s) => `${s.label} ${format(s.values.at(-1) ?? 0)}`).join(', ')}
          onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
          }}
          onBlur={() => setHover(null)}
          className="outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {y.ticks(4).map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
              <text
                x={pad.l - 6}
                y={y(t)}
                dy="0.35em"
                textAnchor="end"
                fontSize={12}
                fill={INK_MUTED}
                className="num"
              >
                {compact(t)}
              </text>
            </g>
          ))}
          {xLabels.map((l, i) =>
            i % tickEvery === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={12} fill={INK_MUTED}>
                {l}
              </text>
            ) : null,
          )}
          {reference && (
            <g>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke={INK_MUTED}
                strokeDasharray="4 4"
              />
              <text x={pad.l + 4} y={y(reference.value) - 5} fontSize={12} fill={INK_MUTED}>
                {reference.label} {format(reference.value)}
              </text>
            </g>
          )}
          {series.map((s, si) => (
            <g key={s.label}>
              {area && (
                <AreaClosed
                  data={s.values}
                  x={(_, i) => x(i)}
                  y={(v) => y(v)}
                  yScale={y}
                  curve={curveMonotoneX}
                  fill={s.color}
                  fillOpacity={0.1}
                />
              )}
              <LinePath data={s.values} x={(_, i) => x(i)} y={(v) => y(v)} curve={curveMonotoneX}>
                {({ path }) => (
                  <m.path
                    d={path(s.values) ?? ''}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: si * 0.1, ease }}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </LinePath>
              <circle
                cx={x(n - 1)}
                cy={y(s.values.at(-1) ?? 0)}
                r={4}
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          ))}
          {endLabels &&
            ends.map((e) => (
              <text key={e.s.label} x={width - pad.r + 8} y={e.y} dy="0.35em" fontSize={12} fill={INK}>
                {e.s.label.length > 12 ? `${e.s.label.slice(0, 11)}…` : e.s.label}
              </text>
            ))}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke={INK_MUTED} />
              {series.map((s) => (
                <circle
                  key={s.label}
                  cx={x(hover)}
                  cy={y(s.values[hover] ?? 0)}
                  r={4}
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={pad.t} width={width} title={xLabels[hover] ?? ''} rows={rows} />
      )}
    </div>
  );
}
