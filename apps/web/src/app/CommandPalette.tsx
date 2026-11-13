// Ctrl/Cmd+K: jump to a page or crop, or run a quick action. Arrow keys move, Enter runs, Esc closes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { resolvedTheme, useUi } from '../stores/ui';
import { useReference } from '../lib/queries';
import { useFmt } from '../lib/format';
import { Icon, type IconName } from '../components/Icon';
import { haptic, makeItRain } from '../lib/effects';
import { toast } from '../stores/toast';
import { navFor } from './nav';

interface Cmd {
  id: string;
  group: string;
  label: string;
  icon: IconName;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, label } = useFmt();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const ref = useReference();
  const { lang, setLang, theme, setTheme } = useUi();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => navigate(path);
    const pages = navFor(user).flatMap((g) =>
      g.items.map((i) => ({
        id: i.key,
        group: t('cmd.pages'),
        label: t(i.label, { ns: i.label.startsWith('app:') ? 'app' : 'common' }),
        icon: i.icon,
        run: go(i.path),
      })),
    );
    const crops =
      user?.role === 'farmer'
        ? (ref.data?.crops ?? []).map((c) => ({
            id: `crop-${c.id}`,
            group: t('cmd.crops'),
            label: `${c.e} ${label(c.n)}`,
            icon: 'planner' as const,
            run: go(`/app/planner/${c.id}`),
          }))
        : [];
    const actions: Cmd[] = [
      {
        id: 'theme',
        group: t('cmd.actions'),
        label: t('cmd.toggleTheme'),
        icon: 'moon',
        run: () => setTheme(resolvedTheme(theme) === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'lang',
        group: t('cmd.actions'),
        label: t('cmd.toggleLang'),
        icon: 'search',
        run: () => setLang(lang === 'en' ? 'hi' : 'en'),
      },
    ];
    if (user?.role === 'farmer')
      actions.push({
        id: 'ask',
        group: t('cmd.actions'),
        label: t('cmd.ask'),
        icon: 'desk',
        run: go('/app/desk?ask=1'),
      });
    return [...pages, ...actions, ...crops];
  }, [user, ref.data, t, label, navigate, lang, setLang, theme, setTheme]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cmds.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q)) : cmds.slice(0, 14);
  }, [cmds, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);
  useEffect(() => setActive(0), [query]);
  // Easter egg: typing "monsoon" (or मानसून) makes it rain across the whole app for five seconds.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q !== 'monsoon' && q !== 'मानसून') return;
    // Clear first, so a re-render (onClose is a new function each time) cannot set it off twice.
    setQuery('');
    onClose();
    haptic([20, 80, 20, 80, 40]);
    makeItRain(5000);
    toast({ tone: 'info', title: t('cmd.monsoon') });
  }, [query, onClose, t]);

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  let lastGroup = '';
  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-50 grid items-start justify-items-center bg-ink/40 px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={t('cmd.label')}
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-3"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === 'Enter') run(results[active]);
              if (e.key === 'Tab') e.preventDefault();
            }}
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Icon name="search" className="text-fg-muted" />
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('cmd.placeholder')}
                aria-label={t('cmd.placeholder')}
                role="combobox"
                aria-expanded="true"
                aria-controls="cmd-list"
                aria-activedescendant={results[active] ? `cmd-${results[active]!.id}` : undefined}
                className="min-h-14 w-full bg-transparent text-lg outline-none"
              />
            </div>
            <ul id="cmd-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
              {!results.length && <li className="p-4 text-center text-fg-muted">{t('cmd.none')}</li>}
              {results.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <li key={c.id} role="presentation">
                    {header && (
                      <div className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                        {header}
                      </div>
                    )}
                    <div
                      id={`cmd-${c.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(c)}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 ${i === active ? 'bg-surface-2' : ''}`}
                    >
                      <Icon name={c.icon} size={18} className="text-fg-muted" />
                      {c.label}
                    </div>
                  </li>
                );
              })}
            </ul>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
