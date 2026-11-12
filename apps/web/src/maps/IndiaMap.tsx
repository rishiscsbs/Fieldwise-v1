// India outline (Natural Earth, India point of view) with district pins. Used by admin and as a locator inset.
import { useState } from 'react';
import { m } from 'framer-motion';
import { INDIA_BOUNDS, INDIA_OUTLINE } from '@fieldwise/shared';
import { useWidth, Tooltip } from '../charts/frame';
import { fit, ringsPath, type LonLat } from './geo';

export interface Pin {
  id: string;
  lat: number;
  lon: number;
  label: string;
  /** Radius in px */
  r?: number;
  /** Lines for the tooltip */
  detail?: { label: string; value: string }[];
  highlight?: boolean;
}

export function IndiaMap({
  pins,
  onSelect,
  maxHeight = 520,
  compact = false,
  label,
}: {
  pins: Pin[];
  onSelect?: (id: string) => void;
  maxHeight?: number;
  /** Small locator: no labels, no tooltips */
  compact?: boolean;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const p = width ? fit(INDIA_BOUNDS, width, compact ? 4 : 12, maxHeight) : null;
  const h = pins.find((x) => x.id === hover);

  return (
    <div ref={ref} className="relative">
      {p && (
        <svg width={width} height={p.height} role="img" aria-label={label}>
          <path
            d={ringsPath(INDIA_OUTLINE as LonLat[][], p)}
            fill="var(--surface-2)"
            stroke="var(--text-muted)"
            strokeWidth={compact ? 0.6 : 0.8}
            strokeLinejoin="round"
          />
          {/* Pulses sit in their own layer, outside the clickable pins, so a pin never keeps changing size. */}
          <g aria-hidden="true" pointerEvents="none">
            {!compact &&
              pins
                .filter((pin) => pin.highlight)
                .map((pin) => {
                  const [x, y] = p([pin.lon, pin.lat]);
                  const r = pin.r ?? 6;
                  return (
                    <m.circle
                      key={pin.id}
                      cx={x}
                      cy={y}
                      r={r}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      initial={{ r, opacity: 0.8 }}
                      animate={{ r: r + 14, opacity: 0 }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                  );
                })}
          </g>
          {pins.map((pin, i) => {
            const [x, y] = p([pin.lon, pin.lat]);
            const r = pin.r ?? (compact ? 4 : 6);
            const interactive = !compact;
            return (
              <g
                key={pin.id}
                tabIndex={interactive ? 0 : undefined}
                role={interactive ? 'button' : undefined}
                aria-label={
                  interactive
                    ? `${pin.label}${pin.detail ? ': ' + pin.detail.map((d) => `${d.label} ${d.value}`).join(', ') : ''}`
                    : undefined
                }
                onMouseEnter={() => interactive && setHover(pin.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => interactive && setHover(pin.id)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect?.(pin.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(pin.id)}
                className={onSelect ? 'cursor-pointer outline-none' : 'outline-none'}
              >
                <m.circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={pin.highlight ? 'var(--accent)' : 'var(--series-1)'}
                  fillOpacity={0.85}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: hover === pin.id ? 1.25 : 1 }}
                  transition={{
                    delay: compact ? 0 : 0.2 + i * 0.05,
                    type: 'spring',
                    stiffness: 400,
                    damping: 18,
                  }}
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
                {!compact && width > 480 && (
                  <text
                    x={x + r + 4}
                    y={y}
                    dy="0.35em"
                    fontSize={12}
                    fill="var(--text)"
                    className="pointer-events-none"
                  >
                    {pin.label}
                  </text>
                )}
                {/* Hit target: bigger than the dot even when hover scales it, so the button keeps a fixed size */}
                {interactive && <circle cx={x} cy={y} r={Math.max(16, r * 1.25 + 6)} fill="transparent" />}
              </g>
            );
          })}
        </svg>
      )}
      {p && h && h.detail && (
        <Tooltip
          x={p([h.lon, h.lat])[0]}
          y={p([h.lon, h.lat])[1]}
          width={width}
          title={h.label}
          rows={h.detail.map((d) => ({ label: d.label, value: d.value }))}
        />
      )}
    </div>
  );
}
