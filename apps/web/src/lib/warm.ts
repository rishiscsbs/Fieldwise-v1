// A warm start for /app. Normally the first screen waits on a chain: render, restore the session, fetch the
// farm list, then fetch the field's advice. Here the session is restored as soon as the script runs, and the
// farm list, reference data and the last viewed field's advice are all fetched together straight after.
// If the remembered field is gone, those requests fail quietly and the pages fetch the right one as usual.
import type { QueryClient } from '@tanstack/react-query';
import { refreshSession } from './api';
import { useUi } from '../stores/ui';
import { useAuth } from '../stores/auth';
import { farmsQuery, fertQuery, mandiQuery, recsQuery, referenceQuery, waterQuery } from './queries';

export async function warmStart(qc: QueryClient, path: string) {
  if (!path.startsWith('/app')) return;
  if (!(await refreshSession())) return;
  void qc.prefetchQuery(farmsQuery);
  void qc.prefetchQuery(referenceQuery);
  const ui = useUi.getState();
  const id = ui.farmId ?? ui.lastFarmId;
  if (!id || useAuth.getState().user?.role !== 'farmer') return;
  // Only what the page being opened shows first.
  const page = path.replace(/\/$/, '');
  if (page === '/app' || page.startsWith('/app/planner')) void qc.prefetchQuery(recsQuery(id));
  if (page === '/app' || page.startsWith('/app/nutrients')) void qc.prefetchQuery(fertQuery(id));
  if (page === '/app' || page.startsWith('/app/weather')) void qc.prefetchQuery(waterQuery(id));
  if (page === '/app' || page.startsWith('/app/market')) void qc.prefetchQuery(mandiQuery(id));
}
