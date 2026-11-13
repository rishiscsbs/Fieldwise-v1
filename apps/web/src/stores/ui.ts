import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LangCode, Season } from '@fieldwise/shared';

type Theme = 'light' | 'dark';

interface UiState {
  lang: LangCode;
  /** null = follow the system setting */
  theme: Theme | null;
  /** The field being viewed; null = the first one */
  farmId: string | null;
  /** Lite mode: no 3D, fewer particles. Set automatically on low-end devices in phase 7, or by hand. */
  lite: boolean;
  /** Season the colours follow when picked by hand; null = the active field's season, else today's. */
  season: Season | null;
  setLang: (lang: LangCode) => void;
  setTheme: (theme: Theme) => void;
  setFarmId: (id: string | null) => void;
  setLite: (lite: boolean) => void;
  setSeason: (season: Season | null) => void;
}

// localStorage can be missing or blocked (private mode, some WebViews). Fall back to memory.
const safeStorage = createJSONStorage(() => {
  try {
    const k = '__fw_probe';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
});

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      lang: 'en',
      theme: null,
      farmId: null,
      lite: false,
      season: null,
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
      setFarmId: (farmId) => set({ farmId }),
      setLite: (lite) => set({ lite }),
      setSeason: (season) => set({ season }),
    }),
    { name: 'fw-ui', storage: safeStorage },
  ),
);

export const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
export const resolvedTheme = (t: Theme | null): Theme => t ?? (systemPrefersDark() ? 'dark' : 'light');
