import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { Icon, type IconName } from './Icon';

/** A headline number tile. Values count up on first show. */
export function Kpi({
  label,
  value,
  meta,
  icon,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  icon: IconName;
  index?: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="card flex min-w-0 flex-col gap-1"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-fg">
          <Icon name={icon} size={18} />
        </span>
        {label}
      </div>
      <div className="num break-words font-display text-3xl leading-tight sm:text-4xl">{value}</div>
      {meta && <div className="text-sm text-fg-muted">{meta}</div>}
    </m.div>
  );
}
