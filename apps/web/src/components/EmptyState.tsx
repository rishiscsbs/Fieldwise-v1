// Empty states with a small original drawing and a clear next step: a sleepy scarecrow when there are no
// alerts, a bird waiting on a fence post when there are no questions. The drawings breathe gently in full
// motion (framer, so reduced motion keeps them still) and are decorative; the text says what is going on.
import type { ReactNode } from 'react';
import { m } from 'framer-motion';

/** A scarecrow dozing in an empty field, with drifting z's. */
function Scarecrow() {
  return (
    <svg width="120" height="112" viewBox="0 0 120 112" aria-hidden="true">
      <path
        d="M8 104c30-8 74-8 104 0"
        stroke="var(--season-a)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
      <path d="M60 104V40" stroke="var(--soil-500)" strokeWidth="4" strokeLinecap="round" />
      <m.g
        animate={{ rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '60px 100px' }}
      >
        {/* Arms of straw on a cross-pole */}
        <path d="M24 56h72" stroke="var(--soil-500)" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M24 56l-6 5M24 56l-7-1M96 56l6 5M96 56l7-1"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Shirt */}
        <path d="M44 50h32l4 30H40Z" fill="var(--primary)" opacity=".85" />
        <path d="M52 62h16M52 70h16" stroke="var(--primary-ink)" strokeWidth="1.5" opacity=".5" />
        {/* Head, closed eyes, smile */}
        <circle cx="60" cy="38" r="12" fill="var(--soil-100)" stroke="var(--soil-500)" strokeWidth="2" />
        <path
          d="M54 37q2 2 4 0M62 37q2 2 4 0"
          stroke="var(--text)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M56 43q4 3 8 0" stroke="var(--text)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* Hat */}
        <path d="M42 30h36" stroke="var(--soil-700)" strokeWidth="4" strokeLinecap="round" />
        <path d="M49 30c0-10 4-14 11-14s11 4 11 14Z" fill="var(--soil-700)" />
      </m.g>
      {[0, 1, 2].map((i) => (
        <m.text
          key={i}
          x={82 + i * 8}
          y={30 - i * 8}
          fontSize={10 + i * 3}
          fontWeight={700}
          fill="var(--text-muted)"
          animate={{ opacity: [0, 1, 0], y: [0, -6, -12] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }}
        >
          z
        </m.text>
      ))}
    </svg>
  );
}

/** A little bird on a fence post, head tilted, waiting. */
function WaitingBird() {
  return (
    <svg width="120" height="112" viewBox="0 0 120 112" aria-hidden="true">
      <path
        d="M8 104c30-8 74-8 104 0"
        stroke="var(--season-a)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".5"
      />
      {/* Fence */}
      <path d="M20 72h80M20 88h80" stroke="var(--soil-300)" strokeWidth="4" strokeLinecap="round" />
      <rect x="52" y="62" width="14" height="44" rx="3" fill="var(--soil-500)" />
      <m.g
        animate={{ rotate: [0, -10, 0, 0], y: [0, -1, 0, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '59px 60px' }}
      >
        {/* Body, wing, head, beak, eye */}
        <ellipse cx="59" cy="50" rx="14" ry="11" fill="var(--season-b)" />
        <path d="M52 50q8 8 18 0" fill="var(--primary)" opacity=".7" />
        <circle cx="68" cy="38" r="8" fill="var(--season-b)" />
        <path d="M75 38l7 2-7 2Z" fill="var(--accent)" />
        <circle cx="70" cy="36" r="1.6" fill="var(--text)" />
        <path d="M46 52l-8 4 9 1" fill="var(--season-b)" />
        <path d="M56 60v3M62 60v3" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" />
      </m.g>
      {/* The question it is waiting for */}
      <m.text
        x="84"
        y="26"
        fontSize="18"
        fontWeight={800}
        fill="var(--accent)"
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        ?
      </m.text>
    </svg>
  );
}

const ART = { scarecrow: Scarecrow, bird: WaitingBird } as const;

export function EmptyState({
  art,
  children,
  action,
}: {
  art: keyof typeof ART;
  children: ReactNode;
  action?: ReactNode;
}) {
  const Art = ART[art];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-2 p-5 text-center">
      <Art />
      <p className="max-w-sm text-fg-muted">{children}</p>
      {action}
    </div>
  );
}
