import { create } from 'zustand';
import type { PublicUser } from '@fieldwise/shared';

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
  setSession: ({ accessToken, user }) => set({ status: 'signedIn', token: accessToken, user }),
  clear: () => set({ status: 'signedOut', token: null, user: null }),
}));
