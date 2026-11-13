import { useId } from 'react';
import { m } from 'framer-motion';

/**
 * Soil water left before irrigation is needed, as water in a soil column: it fills on first show and rises or
 * drains to each new level, with a gently moving surface. `left` and `capacity` are mm; the number and
 * percentage are also written out.
 */
export function MoistureGauge({ left, capacity, label }: { left: number; capacity: number; label: string }) {
  const id = useId();
  const pct = Math.max(0, Math.min(1, capacity ? left / capacity : 0));
  const H = 180;
  const level = H - pct * H;
  // Water is always water-coloured; the level is in the number beside it, not in a status colour.
  const tone = 'var(--series-2)';
  return (
    <div className="flex items-center gap-5">
      <svg
        width="88"
        height={H + 4}
        viewBox={`0 0 88 ${H + 4}`}
        role="img"
        aria-label={`${label}: ${Math.round(left)} / ${Math.round(capacity)} mm`}
      >
        <defs>
          <clipPath id={`${id}-col`}>
            <rect x="2" y="2" width="84" height={H} rx="14" />
          </clipPath>
          <pattern id={`${id}-grain`} width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="1" fill="var(--soil-300)" opacity="0.6" />
            <circle cx="7" cy="8" r="0.8" fill="var(--soil-700)" opacity="0.4" />
          </pattern>
        </defs>
        <g clipPath={`url(#${id}-col)`}>
          <rect x="0" y="0" width="88" height={H + 4} fill="var(--soil-100)" />
          <rect x="0" y="0" width="88" height={H + 4} fill={`url(#${id}-grain)`} />
          <m.g
            initial={{ y: H }}
            animate={{ y: level }}
            transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <m.path
              d="M0 6 Q 11 0 22 6 T 44 6 T 66 6 T 88 6 T 110 6 V 400 H 0 Z"
              fill={tone}
              opacity="0.75"
              animate={{ x: [0, -22, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </m.g>
          {/* A drop falls in as the column fills. */}
          <m.path
            d="M44 0c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15Z"
            fill={tone}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: [-30, level - 6], opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.85, 1], ease: 'easeIn' }}
          />
        </g>
        <rect x="2" y="2" width="84" height={H} rx="14" fill="none" stroke="var(--border)" strokeWidth="2" />
      </svg>
      <div>
        <div className="num-hero">{Math.round(pct * 100)}%</div>
        <div className="num text-sm text-fg-muted">
          {Math.round(left)} / {Math.round(capacity)} mm
        </div>
      </div>
    </div>
  );
}

/** A small water column for one day's soil water, for the forecast day cards. Decorative; the % is written out. */
export function WaterColumn({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <span
      aria-hidden="true"
      className="relative block h-12 w-5 overflow-hidden rounded-full bg-soil-100 ring-1 ring-line"
    >
      <m.span
        className="absolute inset-x-0 bottom-0 rounded-b-full bg-series-2 opacity-75"
        initial={{ height: 0 }}
        animate={{ height: `${p * 100}%` }}
        transition={{ duration: 1, delay, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </span>
  );
}
