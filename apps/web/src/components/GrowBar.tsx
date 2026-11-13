// A 0–100 score drawn as a crop growing along a furrow: the green row fills to the score and a plant stands
// at its tip, a seedling for low scores, leafy in the middle and in grain or flower near the top. The number
// is always written beside it. Under reduced motion it appears at its final size with no growth.
import { m } from 'framer-motion';

type Tone = 'primary' | 'accent';

/** Plant at the tip of the row. Stage 0 seedling, 1 leafy, 2 in grain. */
function Plant({ stage, tone }: { stage: 0 | 1 | 2; tone: Tone }) {
  // Plants stay leaf green whatever the season; the chosen crop's plant is a deeper green.
  const leaf = tone === 'accent' ? 'var(--leaf-700)' : 'var(--leaf-500)';
  return (
    <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true" className="overflow-visible">
      <path d="M14 31V12" stroke={leaf} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 22c-6 0-9-4-9-8 6 0 9 3 9 8Z" fill={leaf} />
      {stage >= 1 && <path d="M14 18c0-6 4-9 9-9 0 6-4 9-9 9Z" fill={leaf} opacity=".8" />}
      {stage >= 1 && <path d="M14 27c5 0 8-3 8-6-5 0-8 2-8 6Z" fill={leaf} opacity=".65" />}
      {stage === 2 && (
        <g fill="var(--season-b)">
          <ellipse cx="14" cy="6" rx="3" ry="5" />
          <ellipse cx="10" cy="9" rx="2.2" ry="3.6" transform="rotate(-25 10 9)" />
          <ellipse cx="18" cy="9" rx="2.2" ry="3.6" transform="rotate(25 18 9)" />
        </g>
      )}
    </svg>
  );
}

export function GrowBar({
  value,
  tone = 'primary',
  delay = 0,
}: {
  value: number;
  tone?: Tone;
  delay?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const stage = v >= 75 ? 2 : v >= 45 ? 1 : 0;
  const ease = [0.2, 0.8, 0.2, 1] as const;
  return (
    <div className="flex items-end gap-3">
      {/* Right padding keeps the plant at 100 clear of the number. */}
      <div className="relative mr-3 h-9 flex-1" aria-hidden="true">
        {/* The furrow */}
        <div className="absolute inset-x-0 bottom-0 h-2.5 rounded-full bg-surface-2" />
        {/* The crop row, filling to the score */}
        <m.div
          className={`absolute bottom-0 left-0 h-2.5 rounded-full ${tone === 'accent' ? 'bg-accent' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.9, delay, ease }}
        />
        {/* The plant rides the tip of the row and grows as it goes */}
        <m.div
          className="absolute bottom-1 -translate-x-1/2 origin-bottom"
          initial={{ left: '0%', scale: 0.2 }}
          animate={{ left: `${v}%`, scale: 1 }}
          transition={{ duration: 0.9, delay, ease }}
        >
          <Plant stage={stage} tone={tone} />
        </m.div>
      </div>
      <span className="num w-10 pb-0.5 text-right text-lg font-bold leading-none">{v}</span>
    </div>
  );
}
