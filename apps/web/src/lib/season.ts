// Seasonal theming. The colours follow, in order: a season picked by hand (the season wheel), the active
// field's season, then today's date. Changing season sweeps the new palette across the page from the control
// that changed it, using the View Transitions API where it exists and skipping it for Lite or reduced motion.
import { useEffect } from 'react';
import { create } from 'zustand';
import type { Season } from '@fieldwise/shared';
import { useUi } from '../stores/ui';
import { prefersReducedMotion } from './effects';

/** Jun–Sep kharif, Oct–Feb rabi, Mar–May zaid. Mirrors seasonFor() in shared without pulling it into the shell. */
export function seasonOn(d: Date): Season {
  const mo = d.getMonth();
  return mo >= 5 && mo <= 8 ? 'kharif' : mo >= 9 || mo <= 1 ? 'rabi' : 'zaid';
}

/** The active field's season, reported by the app shell once farms have loaded. */
export const useFieldSeason = create<{ season: Season | null; set: (s: Season | null) => void }>((set) => ({
  season: null,
  set: (season) => set({ season }),
}));

export function useSeason(): Season {
  const picked = useUi((s) => s.season);
  const field = useFieldSeason((s) => s.season);
  return picked ?? field ?? seasonOn(new Date());
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

let sweepFrom: { x: number; y: number } | null = null;

/** Picks a season by hand. Pass the element that triggered it so the colour sweep starts there. */
export function pickSeason(season: Season | null, from?: Element | null) {
  const r = from?.getBoundingClientRect();
  sweepFrom = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 0 };
  useUi.getState().setSeason(season);
}

function apply(season: Season) {
  const root = document.documentElement;
  if (root.dataset.season === season) return;
  const doc = document as ViewTransitionDoc;
  // Only a season picked by hand sweeps; the field loading or the landing story scrolling just fades.
  const calm =
    !sweepFrom ||
    prefersReducedMotion() ||
    useUi.getState().lite ||
    !doc.startViewTransition ||
    !root.dataset.season;
  if (calm) {
    sweepFrom = null;
    root.dataset.season = season;
    return;
  }
  const { x, y } = sweepFrom!;
  sweepFrom = null;
  root.style.setProperty('--sweep-x', `${x}px`);
  root.style.setProperty('--sweep-y', `${y}px`);
  root.dataset.sweeping = '';
  doc.startViewTransition!(() => {
    root.dataset.season = season;
  }).finished.finally(() => delete root.dataset.sweeping);
}

/** Keeps <html data-season> in step with the effective season. Mounted once, in App. */
export function useSeasonTheme() {
  const season = useSeason();
  useEffect(() => apply(season), [season]);
}
