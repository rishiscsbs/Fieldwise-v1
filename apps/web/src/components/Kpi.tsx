import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { Icon, type IconName } from './Icon';

/**
 * A headline number tile: solid surface (data never sits on glass), a season-tinted icon and a thin season
 * stripe, and a monumental number. `size="text"` is for values that are words (a crop name) rather than numbers.
 */
export function Kpi({
  label,
  value,
  meta,
  icon,
  index = 0,
  size = 'hero',
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  icon: IconName;
  index?: number;
  size?: 'hero' | 'text';
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      className="card relative flex min-w-0 flex-col gap-2 overflow-hidden"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-season-a via-season-b to-season-c"
      />
      <div className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-season-c text-fg">
          <Icon name={icon} size={18} />
        </span>
        {label}
      </div>
      <div
        className={
          size === 'hero'
            ? 'num-hero break-words'
            : 'break-words font-display text-3xl font-extrabold leading-tight sm:text-4xl'
        }
      >
        {value}
      </div>
      {meta && <div className="text-sm text-fg-muted">{meta}</div>}
    </m.div>
  );
}
