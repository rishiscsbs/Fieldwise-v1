// The officer's district: fields, open questions and a pest-sighting density layer, drawn without a tile
// server. Coordinates are real (farm locations); the background is a plain graticule with a scale bar,
// and a small India map shows where the district sits.
import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import type { OfficerMapDto, PestPointsDto } from '../lib/api-types';
import { Tooltip, useWidth, type TipRow } from '../charts/frame';
import { boundsOf, fit, lonKm, type LonLat } from './geo';
import { IndiaMap } from './IndiaMap';
import { useEffectsMode } from '../lib/motion-mode';

type Hover = { kind: 'farm' | 'ticket'; id: string } | null;

export interface DistrictMapLabels {
  map: string;
  locator: string;
  farm: string;
  farmer: string;
  crop: string;
  area: string;
  waiting: (iso: string) => string;
  cropName: (id: string | null) => string;
  district: string;
}

export function DistrictMap({
  data,
  pests,
  layers,
  onTicket,
  labels,
}: {
  data: OfficerMapDto;
  pests: PestPointsDto['reports'];
  layers: { farms: boolean; tickets: boolean; pests: boolean };
  onTicket: (id: string) => void;
  labels: DistrictMapLabels;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Hover>(null);
  // Open questions pulse in full motion only.
  const pulse = useEffectsMode() === 'full';

  const bounds = useMemo(() => {
    const pts: LonLat[] = [
      [data.district.lon, data.district.lat],
      ...data.farms.map((f) => [f.lon, f.lat] as LonLat),
      ...pests.map((r) => [r.lon, r.lat] as LonLat),
    ];
    return boundsOf(pts, 0.12, 0.08);
  }, [data, pests]);
  const p = width ? fit(bounds, width, 16, Math.min(520, Math.max(320, width * 0.75))) : null;

  // Pest density: soft blobs of one hue that darken where sightings overlap (a sequential, single-hue encoding).
  useEffect(() => {
    const el = canvas.current;
    if (!el || !p) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = p.width * dpr;
    el.height = p.height * dpr;
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, p.width, p.height);
    if (!layers.pests) return;
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--series-4').trim() || '#ae4976';
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const radius = Math.max(14, p.kx * 0.045); // ~5 km
    for (const s of pests) {
      const [x, y] = p([s.lon, s.lat]);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.38)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [p?.width, p?.height, bounds, pests, layers.pests]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <div ref={ref} className="h-80" />;

  // Graticule every 0.1° (about 11 km).
  const step = 0.1;
  const lons: number[] = [];
  for (let x = Math.ceil(bounds[0] / step) * step; x <= bounds[2]; x += step) lons.push(+x.toFixed(2));
  const lats: number[] = [];
  for (let y = Math.ceil(bounds[1] / step) * step; y <= bounds[3]; y += step) lats.push(+y.toFixed(2));
  const kmBar = 10;
  const barPx = (kmBar / lonKm(1, data.district.lat)) * p.kx;

  const farm = hover?.kind === 'farm' ? data.farms.find((f) => f.id === hover.id) : undefined;
  const ticket = hover?.kind === 'ticket' ? data.tickets.find((t) => t.id === hover.id) : undefined;
  const tipAt = farm ? p([farm.lon, farm.lat]) : ticket ? p([ticket.lon, ticket.lat]) : null;
  const tipRows: TipRow[] = farm
    ? [
        { label: labels.farmer, value: farm.farmer },
        { label: labels.crop, value: labels.cropName(farm.crop) },
        { label: labels.area, value: String(farm.areaAcres) },
      ]
    : ticket
      ? [
          { label: labels.farmer, value: ticket.farmer },
          { label: '', value: labels.waiting(ticket.createdAt) },
        ]
      : [];
  const [cx, cy] = p([data.district.lon, data.district.lat]);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-season-c to-surface-2"
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        className="absolute left-0 top-0"
        style={{ width: p.width, height: p.height }}
      />
      {/* A labelled group, not an img: the farm and question markers inside take focus. */}
      <svg width={p.width} height={p.height} role="group" aria-label={labels.map} className="relative">
        {/* Faint ploughed furrows so the map reads as farmland, not a blank grid. */}
        <defs>
          <pattern
            id="dm-furrows"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-24)"
          >
            <line
              x1="0"
              y1="7"
              x2="14"
              y2="7"
              stroke="var(--season-a)"
              strokeOpacity="0.12"
              strokeWidth="3"
            />
          </pattern>
        </defs>
        <rect width={p.width} height={p.height} fill="url(#dm-furrows)" aria-hidden="true" />
        {lons.map((x) => (
          <line
            key={`x${x}`}
            x1={p([x, bounds[1]])[0]}
            x2={p([x, bounds[1]])[0]}
            y1={0}
            y2={p.height}
            stroke="var(--border)"
            strokeDasharray="2 5"
          />
        ))}
        {lats.map((y) => (
          <line
            key={`y${y}`}
            x1={0}
            x2={p.width}
            y1={p([bounds[0], y])[1]}
            y2={p([bounds[0], y])[1]}
            stroke="var(--border)"
            strokeDasharray="2 5"
          />
        ))}
        {lats
          .filter((_, i) => i % 2 === 0)
          .map((y) => (
            <text
              key={`ly${y}`}
              x={4}
              y={p([bounds[0], y])[1] - 3}
              fontSize={10}
              fill="var(--text-muted)"
              className="num"
            >
              {y.toFixed(1)}°N
            </text>
          ))}

        {/* District centre */}
        <g aria-hidden="true">
          <rect
            x={cx - 6}
            y={cy - 6}
            width={12}
            height={12}
            transform={`rotate(45 ${cx} ${cy})`}
            fill="var(--text)"
          />
          <text
            x={cx + 12}
            y={cy}
            dy="0.35em"
            fontSize={13}
            fontWeight={700}
            fill="var(--text)"
            paintOrder="stroke"
            stroke="var(--surface-2)"
            strokeWidth={4}
          >
            {labels.district}
          </text>
        </g>

        {layers.farms &&
          data.farms.map((f, i) => {
            const [x, y] = p([f.lon, f.lat]);
            return (
              <g key={f.id}>
                {/* A soft halo makes each field read as a patch of crop, not a dot. */}
                <circle cx={x} cy={y} r={11} fill="var(--series-1)" opacity={0.18} aria-hidden="true" />
                <m.circle
                  cx={x}
                  cy={y}
                  r={hover?.id === f.id ? 7 : 5}
                  fill="var(--series-1)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  tabIndex={0}
                  role="img"
                  aria-label={`${labels.farm}: ${f.name}, ${f.farmer}, ${labels.cropName(f.crop)}`}
                  onMouseEnter={() => setHover({ kind: 'farm', id: f.id })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ kind: 'farm', id: f.id })}
                  onBlur={() => setHover(null)}
                  className="outline-none focus-visible:stroke-focus"
                />
              </g>
            );
          })}

        {layers.tickets &&
          data.tickets.map((tk) => {
            const [x, y] = p([tk.lon, tk.lat]);
            return (
              <g
                key={tk.id}
                tabIndex={0}
                role="button"
                aria-label={`${tk.subject}. ${labels.waiting(tk.createdAt)}`}
                onMouseEnter={() => setHover({ kind: 'ticket', id: tk.id })}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover({ kind: 'ticket', id: tk.id })}
                onBlur={() => setHover(null)}
                onClick={() => onTicket(tk.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTicket(tk.id)}
                className="cursor-pointer outline-none"
              >
                {pulse && (
                  <m.circle
                    cx={x}
                    cy={y - 14}
                    fill="none"
                    stroke="var(--warn)"
                    strokeWidth={2}
                    initial={{ r: 11, opacity: 0.6 }}
                    animate={{ r: 24, opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                    aria-hidden="true"
                  />
                )}
                <m.circle
                  cx={x}
                  cy={y - 14}
                  r={11}
                  fill="var(--warn)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  initial={{ scale: 0 }}
                  animate={{ scale: hover?.id === tk.id ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 16 }}
                  style={{ transformOrigin: `${x}px ${y - 14}px` }}
                />
                <path d={`M${x - 4},${y - 5} L${x},${y} L${x + 4},${y - 5}Z`} fill="var(--warn)" />
                <text
                  x={x}
                  y={y - 14}
                  dy="0.35em"
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="var(--surface)"
                >
                  ?
                </text>
                <circle cx={x} cy={y - 12} r={18} fill="transparent" />
              </g>
            );
          })}

        {/* Scale bar */}
        <g transform={`translate(${p.width - barPx - 16}, ${p.height - 18})`} aria-hidden="true">
          <line x1={0} x2={barPx} y1={0} y2={0} stroke="var(--text)" strokeWidth={2} />
          <line x1={0} x2={0} y1={-4} y2={4} stroke="var(--text)" strokeWidth={2} />
          <line x1={barPx} x2={barPx} y1={-4} y2={4} stroke="var(--text)" strokeWidth={2} />
          <text x={barPx / 2} y={-6} textAnchor="middle" fontSize={11} fill="var(--text)">
            {kmBar} km
          </text>
        </g>
      </svg>

      <div className="absolute right-2 top-2 w-24 rounded-lg border border-glass-line bg-glass-strong p-1 shadow-glass sm:w-28">
        <IndiaMap
          compact
          maxHeight={130}
          label={labels.locator}
          pins={[
            {
              id: data.district.id,
              lat: data.district.lat,
              lon: data.district.lon,
              label: labels.district,
              highlight: true,
              r: 4,
            },
          ]}
        />
      </div>

      {tipAt && (farm || ticket) && (
        <Tooltip
          x={tipAt[0]}
          y={tipAt[1]}
          width={p.width}
          title={farm ? farm.name : ticket!.subject}
          rows={tipRows}
        />
      )}
    </div>
  );
}
