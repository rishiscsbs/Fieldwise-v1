import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolvedTheme, useUi } from './stores/ui';
import { useAuth } from './stores/auth';
import { refreshSession } from './lib/api';
import { useActiveFarm } from './lib/farm';
import { useSeasonTheme } from './lib/season';
import { weakHardware } from './lib/motion-mode';
import { PageSkeleton } from './components/ui';
import { Toasts } from './app/Toasts';
import { CursorGlow } from './app/CursorGlow';
import { preloadPagePhoto } from './lib/photos';

// Every page is its own chunk; only the shell ships up front.
const AppShell = lazy(() => import('./app/AppShell').then((m) => ({ default: m.AppShell })));

// Opening /app straight away (a bookmark, the installed PWA) waits on a chain of round trips: restore the
// session, then load the app shell, then the page. Start fetching both chunks now, alongside the session check.
// The lazy() factories above and below get the same cached module promise, so nothing loads twice.
const PREFETCH: [RegExp, () => Promise<unknown>][] = [
  [/^\/app\/?$/, () => import('./routes/Overview')],
  [/^\/app\/planner/, () => import('./routes/Planner')],
  [/^\/app\/nutrients/, () => import('./routes/Nutrients')],
  [/^\/app\/health/, () => import('./routes/Health')],
  [/^\/app\/weather/, () => import('./routes/Weather')],
  [/^\/app\/market/, () => import('./routes/Market')],
  [/^\/app\/desk/, () => import('./routes/Desk')],
  [/^\/app\/officer/, () => import('./routes/Officer')],
];
if (typeof window !== 'undefined') preloadPagePhoto(location.pathname);
if (typeof window !== 'undefined' && location.pathname.startsWith('/app')) {
  void import('./app/AppShell');
  PREFETCH.find(([re]) => re.test(location.pathname))?.[1]();
}
const Landing = lazy(() => import('./routes/Landing').then((m) => ({ default: m.Landing })));
const Pitch = lazy(() => import('./routes/Pitch').then((m) => ({ default: m.Pitch })));
const Presenter = lazy(() => import('./routes/Presenter').then((m) => ({ default: m.Presenter })));
const DesignSystem = lazy(() => import('./routes/DesignSystem').then((m) => ({ default: m.DesignSystem })));
const Login = lazy(() => import('./routes/Login').then((m) => ({ default: m.Login })));
const Welcome = lazy(() => import('./routes/Welcome').then((m) => ({ default: m.Welcome })));
const Overview = lazy(() => import('./routes/Overview').then((m) => ({ default: m.Overview })));
const FarmPage = lazy(() => import('./routes/FarmPage').then((m) => ({ default: m.FarmPage })));
const Planner = lazy(() => import('./routes/Planner').then((m) => ({ default: m.Planner })));
const CropDetail = lazy(() => import('./routes/CropDetail').then((m) => ({ default: m.CropDetail })));
const Nutrients = lazy(() => import('./routes/Nutrients').then((m) => ({ default: m.Nutrients })));
const Health = lazy(() => import('./routes/Health').then((m) => ({ default: m.Health })));
const Weather = lazy(() => import('./routes/Weather').then((m) => ({ default: m.Weather })));
const Market = lazy(() => import('./routes/Market').then((m) => ({ default: m.Market })));
const Desk = lazy(() => import('./routes/Desk').then((m) => ({ default: m.Desk })));
const Officer = lazy(() => import('./routes/Officer').then((m) => ({ default: m.Officer })));
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })));

function Splash() {
  const { t } = useTranslation();
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <span className="flex items-center gap-3 font-display text-2xl">
        <img src="/favicon.svg" alt="" width={32} height={32} className="animate-pulse" />
        {t('loading')}
      </span>
    </div>
  );
}

/** Restores the session from the refresh cookie once, then guards /app. */
function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'signedOut')
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

/** Farmers without a name or a field are sent to onboarding first. Officers land on their dashboard, admins on admin. */
function Start() {
  const user = useAuth((s) => s.user);
  const { farms, isLoading } = useActiveFarm();
  if (user?.role === 'admin') return <Navigate to="/app/admin" replace />;
  if (user?.role === 'officer') return <Navigate to="/app/officer" replace />;
  if (!user) return <PageSkeleton />;
  if (!user.name) return <Navigate to="/app/welcome" replace />;
  // A farmer with a name almost always has a field: show the overview (its greeting paints at once) while the
  // farm list loads, and only send them to onboarding if it turns out to be empty.
  if (!isLoading && !farms.length) return <Navigate to="/app/welcome" replace />;
  return <Overview />;
}

export function App() {
  const theme = useUi((s) => s.theme);
  const lite = useUi((s) => s.lite);
  useSeasonTheme();
  // CSS hooks for Lite mode (no glass blur, no drifting texture).
  useEffect(() => {
    document.documentElement.toggleAttribute('data-lite', lite || weakHardware());
  }, [lite]);
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (useAuth.getState().status === 'loading') void refreshSession();
  }, []);

  return (
    <BrowserRouter>
      <CursorGlow />
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pitch" element={<Pitch />} />
          <Route path="/pitch/presenter" element={<Presenter />} />
          <Route path="/design" element={<DesignSystem />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/app/welcome"
            element={
              <RequireAuth>
                <Welcome />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <Start />
                </Suspense>
              }
            />
            {(
              [
                ['farm', <FarmPage key="f" />],
                ['farm/new', <FarmPage key="fn" create />],
                ['planner', <Planner key="p" />],
                ['planner/:cropId', <CropDetail key="cd" />],
                ['nutrients', <Nutrients key="n" />],
                ['health', <Health key="h" />],
                ['weather', <Weather key="w" />],
                ['market', <Market key="m" />],
                ['desk', <Desk key="d" />],
                ['desk/:ticketId', <Desk key="dt" />],
                ['officer', <Officer key="o" />],
                ['admin', <Admin key="a" />],
              ] as const
            ).map(([path, el]) => (
              <Route key={path} path={path} element={<Suspense fallback={<PageSkeleton />}>{el}</Suspense>} />
            ))}
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toasts />
    </BrowserRouter>
  );
}
