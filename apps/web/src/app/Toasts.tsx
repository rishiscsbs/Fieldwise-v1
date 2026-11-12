import { AnimatePresence, m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useToasts } from '../stores/toast';
import { Icon } from '../components/Icon';

const ICON = { good: 'check', warn: 'alert', bad: 'x', info: 'info' } as const;
const BORDER = { good: 'border-good', warn: 'border-warn', bad: 'border-bad', info: 'border-info' } as const;
const TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad', info: 'text-info' } as const;

/** Stacked toasts, announced politely to screen readers. */
export function Toasts() {
  const { t } = useTranslation();
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      <AnimatePresence initial={false}>
        {toasts.map((x) => (
          <m.div
            key={x.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg border-l-4 bg-surface p-3 shadow-3 ${BORDER[x.tone]}`}
          >
            <span className={TEXT[x.tone]}>
              <Icon name={ICON[x.tone]} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{x.title}</p>
              {x.body && <p className="text-sm text-fg-muted">{x.body}</p>}
            </div>
            <button
              type="button"
              className="-m-1 grid h-9 w-9 place-items-center rounded-md text-fg-muted hover:bg-surface-2"
              onClick={() => dismiss(x.id)}
              aria-label={t('notif.close')}
            >
              <Icon name="close" size={16} />
            </button>
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
