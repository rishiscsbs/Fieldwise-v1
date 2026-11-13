// The fertiliser plan as sacks that drop into a hand cart and stack up, one sack per bag, in each product's
// own colour. Up to 15 sacks are drawn; the rest show as "+n". The bag counts are also written out in the list
// beside it, and the drawing has a text alternative. Reduced motion places the sacks without the drop.
import { m } from 'framer-motion';

export interface SackGroup {
  id: string;
  /** Printed on the sack (UREA, DAP, MOP). */
  code: string;
  colour: string;
  bags: number;
}

const MAX = 15;
const PER_ROW = 6;
const W = 34;
const H = 30;

export function SackCart({
  groups,
  label,
  moreLabel,
}: {
  groups: SackGroup[];
  label: string;
  moreLabel: (n: number) => string;
}) {
  const sacks = groups.flatMap((g) => Array.from({ length: g.bags }, () => g));
  const shown = sacks.slice(0, MAX);
  const extra = sacks.length - shown.length;
  const rows = Math.ceil(shown.length / PER_ROW) || 1;
  const top = 150 - rows * (H - 4) - 20;
  const vy = Math.max(0, top - (extra > 0 ? 18 : 4));
  return (
    <svg
      viewBox={`0 ${vy} 320 ${190 - vy}`}
      className="w-full overflow-visible"
      role="img"
      aria-label={label}
    >
      {/* Ground shadow and the cart: a flatbed with two wheels and a handle */}
      <ellipse cx="160" cy="180" rx="130" ry="6" fill="var(--text)" opacity=".08" />
      <path d="M262 150l34-44" stroke="var(--text-muted)" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 150h232" stroke="var(--text-muted)" strokeWidth="7" strokeLinecap="round" />
      <path d="M44 150v-14M268 150v-14" stroke="var(--text-muted)" strokeWidth="4" strokeLinecap="round" />
      {[86, 230].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="166" r="13" fill="var(--surface)" stroke="var(--text-muted)" strokeWidth="4" />
          <circle cx={cx} cy="166" r="3" fill="var(--text-muted)" />
        </g>
      ))}
      {shown.map((g, i) => {
        const row = Math.floor(i / PER_ROW);
        const col = i % PER_ROW;
        // Each row sits a little in from the one below, like a real stack.
        const x = 54 + col * (W + 2) + (row % 2) * (W / 2);
        const y = 146 - (row + 1) * (H - 4);
        return (
          <m.g
            key={i}
            initial={{ y: -(y + 60), opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 17, delay: 0.15 + i * 0.07 }}
          >
            <path
              d={`M${x + 4} ${y + 6}q${W / 2 - 4} -8 ${W - 8} 0l3 ${H - 8}q-${W / 2 - 1} 6 -${W - 2} 0Z`}
              fill={g.colour}
              stroke="var(--text)"
              strokeOpacity=".35"
              strokeWidth="1.2"
            />
            <path
              d={`M${x + W / 2 - 4} ${y + 3}l4 -4 4 4`}
              fill="none"
              stroke="var(--text)"
              strokeOpacity=".4"
              strokeWidth="1.4"
            />
            <text
              x={x + W / 2}
              y={y + H / 2 + 3}
              textAnchor="middle"
              fontSize="7"
              fontWeight="700"
              fill="var(--ink)"
              opacity=".7"
            >
              {g.code}
            </text>
          </m.g>
        );
      })}
      {extra > 0 && (
        <text
          x="160"
          y={Math.max(14, top)}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fill="var(--text)"
        >
          {moreLabel(extra)}
        </text>
      )}
    </svg>
  );
}
