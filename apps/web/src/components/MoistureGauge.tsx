import { m } from 'framer-motion';

/**
 * Soil water left before irrigation is needed, as water rising in a soil column.
 * `left` and `capacity` are mm; the number and percentage are also written out.
 */
export function MoistureGauge({ left, capacity, label }: { left: number; capacity: number; label: string }) {
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
          <clipPath id="soil-col">
            <rect x="2" y="2" width="84" height={H} rx="14" />
          </clipPath>
          <pattern id="soil-grain" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="1" fill="var(--soil-300)" opacity="0.6" />
            <circle cx="7" cy="8" r="0.8" fill="var(--soil-700)" opacity="0.4" />
          </pattern>
        </defs>
        <g clipPath="url(#soil-col)">
          <rect x="0" y="0" width="88" height={H + 4} fill="var(--soil-100)" />
          <rect x="0" y="0" width="88" height={H + 4} fill="url(#soil-grain)" />
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
        </g>
        <rect x="2" y="2" width="84" height={H} rx="14" fill="none" stroke="var(--border)" strokeWidth="2" />
      </svg>
      <div>
        <div className="num font-display text-4xl">{Math.round(pct * 100)}%</div>
        <div className="num text-sm text-fg-muted">
          {Math.round(left)} / {Math.round(capacity)} mm
        </div>
      </div>
    </div>
  );
}
