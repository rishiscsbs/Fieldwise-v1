// The fertiliser schedule as a growing crop: each application stands at its growth stage (a seed in the
// furrow at sowing, a seedling at day 25–30, a leafy plant before flowering), joined by a furrow line.
// Columns on wide screens, a vertical list on phones. The plants are decorative; the text carries the plan.
import { m } from 'framer-motion';

export type FeedStage = 'sow' | 'early' | 'late';

/** Which growth stage a schedule key belongs to (basal* at sowing, top1, top2). */
export const stageOf = (key: string): FeedStage =>
  key.startsWith('top2') ? 'late' : key.startsWith('top1') ? 'early' : 'sow';

function StagePlant({ stage }: { stage: FeedStage }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M4 54c18-6 38-6 56 0"
        stroke="var(--season-a)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
      <ellipse cx="32" cy="55" rx="16" ry="4" fill="var(--surface-2)" />
      {stage === 'sow' && (
        <g>
          <ellipse cx="32" cy="50" rx="5" ry="3.5" fill="var(--season-b)" />
          <path
            d="M32 47c0-4 2-6 5-7"
            stroke="var(--leaf-700)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
      {stage !== 'sow' && (
        <path
          d={`M32 54V${stage === 'early' ? 34 : 18}`}
          stroke="var(--leaf-700)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
      {stage !== 'sow' && <path d="M32 44c-8 0-12-5-12-10 8 0 12 4 12 10Z" fill="var(--leaf-500)" />}
      {stage !== 'sow' && (
        <path d="M32 40c0-8 5-11 11-11 0 7-5 11-11 11Z" fill="var(--leaf-500)" opacity=".8" />
      )}
      {stage === 'late' && (
        <path d="M32 30c-7 0-11-4-11-9 7 0 11 4 11 9Z" fill="var(--leaf-500)" opacity=".7" />
      )}
      {stage === 'late' && (
        <path d="M32 26c0-7 4-10 10-10 0 6-4 10-10 10Z" fill="var(--leaf-500)" opacity=".9" />
      )}
      {stage === 'late' && <circle cx="32" cy="15" r="4" fill="var(--accent)" />}
    </svg>
  );
}

// Full class names for Tailwind's scanner. One application lays out as a row, not a lone column.
const COLS: Record<number, string> = { 1: '', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' };
const FURROW: Record<number, string> = {
  2: 'md:left-1/4 md:right-1/4',
  3: 'md:left-[16.7%] md:right-[16.7%]',
};

export function FeedTimeline({
  items,
  stageLabel,
}: {
  items: { key: string; text: string }[];
  stageLabel: (s: FeedStage) => string;
}) {
  return (
    <ol className={`relative grid gap-4 md:gap-6 ${COLS[items.length] ?? 'md:grid-cols-3'}`}>
      {/* The furrow joining the stages */}
      {items.length > 1 && (
        <span
          aria-hidden="true"
          className={`absolute bottom-6 left-8 top-6 border-l-2 border-dashed border-line md:bottom-auto md:top-[38px] md:border-l-0 md:border-t-2 ${FURROW[items.length] ?? FURROW[3]}`}
        />
      )}
      {items.map((it, i) => {
        const stage = stageOf(it.key);
        return (
          <m.li
            key={it.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.15, duration: 0.4 }}
            className={`relative flex gap-4 ${items.length > 1 ? 'md:flex-col md:items-center md:text-center' : 'items-center'}`}
          >
            <m.div
              className="shrink-0 rounded-full bg-surface p-1 shadow-1 ring-1 ring-line"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 300, damping: 18 }}
            >
              <StagePlant stage={stage} />
            </m.div>
            <div className="min-w-0">
              <span className="badge bg-accent-soft text-fg">{stageLabel(stage)}</span>
              <p className="mt-2">{it.text}</p>
            </div>
          </m.li>
        );
      })}
    </ol>
  );
}
