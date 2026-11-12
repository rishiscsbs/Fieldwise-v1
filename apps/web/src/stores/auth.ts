import { create } from 'zustand';
import type { PublicUser } from '@fieldwise/shared';

const KEY = 'fw-last-user';
/** The last signed-in user, so the app can open offline and show cached advice. localStorage may be blocked. */
export const lastUser = {
  get: (): PublicUser | null => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? 'null') as PublicUser | null;
    } catch {
      return null;
    }
  },
  set: (u: PublicUser | null) => {
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage blocked: offline start is simply unavailable */
    }
  },
};

/** The access token lives in memory only; the refresh token is an httpOnly cookie the browser sends to /api/auth. */
interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  token: string | null;
  user: PublicUser | null;
  setSession: (s: { accessToken: string; user: PublicUser }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  status: 'loading',
  token: null,
  user: null,
  setSession: ({ accessToken, user }) => {
    lastUser.set(user);
    set({ status: 'signedIn', token: accessToken, user });
  },
  clear: () => {
    lastUser.set(null);
    // Cached advice is personal: drop the offline cache so the next person on a shared phone cannot read it.
    if (typeof caches !== 'undefined')
      void caches.keys().then((ks) => ks.forEach((k) => void caches.delete(k)));
    set({ status: 'signedOut', token: null, user: null });
  },
}));
