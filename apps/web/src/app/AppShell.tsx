// Signed-in layout: sidebar (drawer on phones), top bar with field switcher, language, theme, read aloud,
// notifications and search, plus page transitions.
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LANGUAGES, type LangCode } from '@fieldwise/shared';
import { useAuth } from '../stores/auth';
import { resolvedTheme, useUi } from '../stores/ui';
import { usePage } from '../stores/page';
import { useFmt } from '../lib/format';
import { useNotifications, useReference } from '../lib/queries';
import { useActiveFarm } from '../lib/farm';
import { useFieldSeason } from '../lib/season';
import { connectLive, disconnectLive } from '../lib/socket';
import { speak, stopSpeaking } from '../lib/speech';
import { api, refreshSession } from '../lib/api';
import { Icon } from '../components/Icon';
import { Toggle } from '../components/Toggle';
import { navFor } from './nav';
import { NotificationCenter } from './NotificationCenter';
import { CommandPalette } from './CommandPalette';

/** Keeps showing the page it was mounted with, so an exiting page does not flash the next one. */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

export function AppShell() {
  const { t, label, lang } = useFmt();
  const user = useAuth((s) => s.user);
  const { setLang, theme, setTheme, setFarmId, lite, setLite } = useUi();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    // Back online after an offline start: swap the offline session for a real one.
    const back = () => {
      on();
      if (!useAuth.getState().token) void refreshSession();
    };
    window.addEventListener('online', back);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', back);
      window.removeEventListener('offline', on);
    };
  }, []);
  const { farm, farms } = useActiveFarm();
  const ref = useReference();
  const notes = useNotifications();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const say = usePage((s) => s.say);
  const [menu, setMenu] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const dark = resolvedTheme(theme) === 'dark';
  const setFieldSeason = useFieldSeason((s) => s.set);

  // The colours follow the field being viewed (unless a season was picked by hand).
  useEffect(() => {
    setFieldSeason(farm?.season ?? null);
    return () => setFieldSeason(null);
  }, [farm?.season, setFieldSeason]);

  useEffect(() => {
    void connectLive(qc);
    return () => disconnectLive();
  }, [qc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMenu(false);
    stopSpeaking();
    setSpeaking(false);
  }, [location.pathname]);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    disconnectLive();
    qc.clear();
    useAuth.getState().clear();
    navigate('/login');
  }, [qc, navigate]);

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (say && speak(say, lang, () => setSpeaking(false))) setSpeaking(true);
  };

  const nav = (
    <nav aria-label={t('shell.menu')} className="flex flex-col gap-6 p-4">
      {navFor(user).map((g) => (
        <div key={g.group || 'staff'}>
          {g.group && (
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {t(g.group, { ns: 'common' })}
            </div>
          )}
          <ul className="flex flex-col gap-1">
            {g.items.map((i) => (
              <li key={i.key}>
                <NavLink
                  to={i.path}
                  end={i.path === '/app'}
                  className={({ isActive }) =>
                    `relative flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold transition-colors duration-1 ${isActive ? 'text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg'}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <m.span
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-md bg-accent-soft"
                          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                        />
                      )}
                      <span className="relative flex items-center gap-3">
                        <Icon name={i.icon} />
                        {t(i.label, { ns: i.label.startsWith('app:') ? 'app' : 'common' })}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <NavLink to="/app" className="flex items-center gap-2 font-display text-2xl text-fg">
      <img src="/favicon.svg" alt="" width={28} height={28} />
      {t('brand')}
    </NavLink>
  );

  const userBox = user && (
    <div className="border-t border-line p-4">
      <div className="mb-3 min-w-0">
        <div className="truncate font-semibold">{user.name || user.phone}</div>
        <div className="text-sm text-fg-muted">{t(`role.${user.role}`)}</div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm sm:hidden">
        <label htmlFor="lang-drawer">{t('language')}</label>
        <select
          id="lang-drawer"
          value={lang}
          onChange={(e) => setLang(e.target.value as LangCode)}
          className="min-h-11 rounded-md border border-line bg-surface px-2"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span>{t('theme.toggle')}</span>
        <Toggle checked={dark} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={t('theme.toggle')} />
      </div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm" title={t('shell.liteHint')}>
        <span>{t('shell.lite')}</span>
        <Toggle checked={lite} onChange={setLite} label={t('shell.lite')} />
      </div>
      <button type="button" className="btn-secondary w-full" onClick={signOut}>
        <Icon name="logout" size={18} />
        {t('shell.signOut')}
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('skip')}
      </a>

      {/* Desktop sidebar */}
      <div className="hidden border-r border-line bg-surface lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col">
          <div className="flex h-16 items-center px-6">{brand}</div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          {userBox}
        </aside>
      </div>

      {/* Phone drawer */}
      <AnimatePresence>
        {menu && (
          <>
            <m.div
              className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenu(false)}
            />
            <m.aside
              role="dialog"
              aria-modal="true"
              aria-label={t('shell.menu')}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-3 lg:hidden"
            >
              <div className="flex h-16 items-center justify-between px-4">
                {brand}
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2"
                  onClick={() => setMenu(false)}
                  aria-label={t('shell.closeMenu')}
                >
                  <Icon name="close" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{nav}</div>
              {userBox}
            </m.aside>
          </>
        )}
      </AnimatePresence>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2 lg:hidden"
              onClick={() => setMenu(true)}
              aria-label={t('shell.menu')}
              aria-expanded={menu}
            >
              <Icon name="menu" />
            </button>
            {user?.role === 'farmer' && farms.length > 0 && (
              <div className="min-w-0 flex-1 sm:flex-none">
                <label htmlFor="farm-switch" className="sr-only">
                  {t('shell.farm')}
                </label>
                <select
                  id="farm-switch"
                  value={farm?.id ?? ''}
                  onChange={(e) =>
                    e.target.value === '__new' ? navigate('/app/farm/new') : setFarmId(e.target.value)
                  }
                  className="min-h-11 w-full truncate rounded-md border border-line bg-surface px-2 text-sm font-semibold sm:w-auto sm:max-w-xs sm:text-base"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ·{' '}
                      {label(ref.data?.districts.find((d) => d.id === f.districtId)?.labels).split(',')[0]}
                    </option>
                  ))}
                  <option value="__new">+ {t('shell.addFarm')}</option>
                </select>
              </div>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="hidden min-h-11 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-fg-muted hover:bg-surface-2 md:flex"
              >
                <Icon name="search" size={16} />
                {t('shell.search')}
                <kbd className="rounded-sm border border-line px-1.5 text-xs">{t('shell.searchHint')}</kbd>
              </button>
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2 md:hidden"
                aria-label={t('shell.search')}
              >
                <Icon name="search" />
              </button>
              {say && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className="grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2"
                  aria-label={speaking ? t('stop', { ns: 'common' }) : t('readAloud', { ns: 'common' })}
                  aria-pressed={speaking}
                >
                  <Icon name={speaking ? 'stop' : 'speaker'} />
                </button>
              )}
              <label htmlFor="lang-switch" className="sr-only">
                {t('language')}
              </label>
              <select
                id="lang-switch"
                value={lang}
                onChange={(e) => setLang(e.target.value as LangCode)}
                className="hidden min-h-11 rounded-md border border-line bg-surface px-2 text-sm sm:block"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                className="relative grid h-11 w-11 place-items-center rounded-md hover:bg-surface-2"
                aria-label={`${t('shell.notifications')}${notes.data?.unread ? `, ${t('notif.unread', { count: notes.data.unread })}` : ''}`}
              >
                <Icon name="bell" />
                <AnimatePresence>
                  {!!notes.data?.unread && (
                    <m.span
                      key={notes.data.unread}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="num absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-xs font-bold text-white"
                      aria-hidden="true"
                    >
                      {notes.data.unread > 9 ? '9+' : notes.data.unread}
                    </m.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </header>

        {!online && (
          <div role="status" className="bg-warn-soft px-4 py-2 text-center text-sm font-semibold text-fg">
            {t('offline')}
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <FrozenOutlet />
            </m.div>
          </AnimatePresence>
        </main>
      </div>

      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
