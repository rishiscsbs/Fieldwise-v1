// Onboarding's companion: a patch of soil where a seed is planted as the farmer fills in their details, a
// sprout comes up as they add the soil card, and a full plant in grain stands at the end. Original drawing;
// decorative (the form carries the meaning). Reduced motion shows each stage without the growing.
import { AnimatePresence, m } from 'framer-motion';

export type GrowthStage = 0 | 1 | 2 | 3;

const leaf = 'var(--leaf-500)';
const leafDeep = 'var(--leaf-700)';
const spring = { type: 'spring', stiffness: 160, damping: 14 } as const;

export function Growth({ stage }: { stage: GrowthStage }) {
  return (
    <svg viewBox="0 0 240 240" className="h-auto w-full max-w-[16rem]" aria-hidden="true">
      {/* Sky disc and a sun that rises when the plant is grown */}
      <circle cx="120" cy="120" r="112" fill="var(--season-c)" />
      <m.circle
        cx="176"
        cy="70"
        r="18"
        fill="var(--accent)"
        initial={false}
        animate={{ opacity: stage === 3 ? 1 : 0.25, cy: stage === 3 ? 62 : 84 }}
        transition={{ duration: 0.8 }}
      />
      {/* Soil mound with furrow lines */}
      <path d="M18 176c40-26 164-26 204 0v26c-60 30-144 30-204 0Z" fill="var(--soil-500)" />
      <path
        d="M40 186c40-12 120-12 160 0M56 198c30-8 98-8 128 0"
        stroke="var(--soil-300)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity=".6"
      />
      {/* The planting hole */}
      <ellipse cx="120" cy="172" rx="14" ry="5" fill="var(--soil-900)" opacity={stage === 0 ? 0.8 : 0.4} />

      <AnimatePresence>
        {stage >= 1 && (
          <m.ellipse
            key="seed"
            cx="120"
            cy="170"
            rx="7"
            ry="5"
            fill="var(--season-b)"
            initial={{ y: -90, opacity: 0 }}
            animate={{ y: 0, opacity: stage >= 2 ? 0 : 1 }}
            transition={{ ...spring, opacity: { delay: stage >= 2 ? 0.3 : 0 } }}
          />
        )}
      </AnimatePresence>

      {/* Stem grows taller with each stage */}
      {stage >= 2 && (
        <m.path
          d={stage === 3 ? 'M120 172C120 140 118 110 120 70' : 'M120 172C120 160 119 148 120 136'}
          stroke={leafDeep}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.7 }}
        />
      )}
      {/* Sprout: two seed leaves */}
      {stage === 2 && (
        <m.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: 0.5 }}
          style={{ transformOrigin: '120px 138px' }}
        >
          <path d="M120 138c-14 0-20-8-20-16 12 0 20 6 20 16Z" fill={leaf} />
          <path d="M120 138c0-12 8-18 20-18 0 10-8 18-20 18Z" fill={leaf} />
        </m.g>
      )}
      {/* Full plant: leaves up the stem and a grain head */}
      {stage === 3 &&
        [
          { d: 'M120 150c-20 0-30-10-30-22 18 0 30 8 30 22Z', o: '120px 150px' },
          { d: 'M120 132c0-18 12-26 30-26 0 14-12 26-30 26Z', o: '120px 132px' },
          { d: 'M120 112c-18 0-26-9-26-20 16 0 26 7 26 20Z', o: '120px 112px' },
          { d: 'M120 96c0-15 10-22 26-22 0 12-10 22-26 22Z', o: '120px 96px' },
        ].map((l, i) => (
          <m.path
            key={i}
            d={l.d}
            fill={i % 2 ? leaf : leafDeep}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...spring, delay: 0.35 + i * 0.12 }}
            style={{ transformOrigin: l.o }}
          />
        ))}
      {stage === 3 && (
        <m.g
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...spring, delay: 0.9 }}
          style={{ transformOrigin: '120px 70px' }}
        >
          {[-14, -7, 0, 7, 14].map((dy, i) => (
            <g key={dy}>
              <ellipse
                cx={114}
                cy={64 + dy}
                rx="5"
                ry="7"
                fill="var(--accent)"
                transform={`rotate(-25 114 ${64 + dy})`}
                opacity={i === 0 ? 0.8 : 1}
              />
              <ellipse
                cx={126}
                cy={64 + dy}
                rx="5"
                ry="7"
                fill="var(--accent)"
                transform={`rotate(25 126 ${64 + dy})`}
                opacity={i === 0 ? 0.8 : 1}
              />
            </g>
          ))}
          <ellipse cx="120" cy="44" rx="5" ry="8" fill="var(--accent)" />
        </m.g>
      )}
    </svg>
  );
}
