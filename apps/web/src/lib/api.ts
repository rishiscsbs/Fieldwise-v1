// Fetch wrapper for the Fieldwise API. Adds the access token, refreshes it once on 401, and turns
// error bodies into ApiError so screens can show the server's (already user-friendly) message.
import type { AuthSession } from '@fieldwise/shared';
import { lastUser, useAuth } from '../stores/auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Offline or server unreachable: keep the last user so cached advice still shows. */
function keepOfflineSession(): false {
  const u = lastUser.get();
  if (u) useAuth.setState({ status: 'signedIn', token: null, user: u });
  else useAuth.getState().clear();
  return false;
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (r) => {
      // 5xx: the server cannot be reached right now, which is not the same as being signed out.
      if (r.status >= 500) return keepOfflineSession();
      // 204 = no valid session; that is the normal signed-out state, not an error.
      if (r.status !== 200) {
        useAuth.getState().clear();
        return false;
      }
      useAuth.getState().setSession((await r.json()) as AuthSession);
      return true;
    })
    // Network error (offline), not a rejected session.
    .catch(keepOfflineSession)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Body = object | FormData | undefined;

export async function api<T>(
  path: string,
  opts: { method?: string; body?: Body; retry?: boolean } = {},
): Promise<T> {
  const { method = opts.body ? 'POST' : 'GET', body, retry = true } = opts;
  const token = useAuth.getState().token;
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? 'error', data.message ?? res.statusText);
  }
  return data as T;
}

/** Seconds-since-epoch expiry from a JWT, or null if it cannot be read. */
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

// Refresh about a minute before the access token expires, so normal use never hits a 401.
let timer: ReturnType<typeof setTimeout> | undefined;
useAuth.subscribe((s, prev) => {
  if (s.token === prev.token) return;
  clearTimeout(timer);
  const exp = s.token ? tokenExpiry(s.token) : null;
  if (exp) timer = setTimeout(() => void refreshSession(), Math.max(5_000, exp * 1000 - Date.now() - 60_000));
});
