import { useEffect, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useMarkRead, useNotifications } from '../lib/queries';
import { useFmt } from '../lib/format';
import { Icon } from '../components/Icon';
import { Empty, Skeleton } from '../components/ui';

/** Slide-over list of alerts and replies. Opening it does not mark items read; clicking one does. */
export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, label, time } = useFmt();
  const q = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            className="fixed inset-0 z-40 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={t('notif.title')}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-3 outline-none"
          >
            <header className="flex items-center justify-between gap-2 border-b border-line p-4">
              <h2 className="font-display text-2xl">{t('notif.title')}</h2>
              <div className="flex items-center gap-1">
                {!!q.data?.unread && (
                  <button type="button" className="btn-quiet" onClick={() => markRead.mutate(undefined)}>
                    {t('notif.markAll')}
                  </button>
                )}
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2"
                  onClick={onClose}
                  aria-label={t('notif.close')}
                >
                  <Icon name="close" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-2">
              {q.isLoading ? (
                <div className="space-y-3 p-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : !q.data?.items.length ? (
                <div className="p-2">
                  <Empty>{t('notif.empty')}</Empty>
                </div>
              ) : (
                <ul>
                  {q.data.items.map((n, i) => (
                    <m.li
                      key={n.id}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 rounded-md p-3 text-left hover:bg-surface-2"
                        onClick={() => {
                          if (!n.readAt) markRead.mutate([n.id]);
                          onClose();
                          navigate(n.type === 'alert' ? '/app/desk' : `/app/desk/${n.refId}`);
                        }}
                      >
                        <span
                          className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.type === 'alert' ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info'}`}
                        >
                          <Icon name={n.type === 'alert' ? 'alert' : 'desk'} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block ${n.readAt ? '' : 'font-semibold'}`}>{label(n.title)}</span>
                          <time className="text-xs text-fg-muted" dateTime={n.createdAt}>
                            {time(n.createdAt)}
                          </time>
                        </span>
                        {!n.readAt && (
                          <span
                            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                            role="img"
                            aria-label={t('notif.new')}
                          />
                        )}
                      </button>
                    </m.li>
                  ))}
                </ul>
              )}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
