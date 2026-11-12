// How much motion to use: full (3D, smooth scroll), lite (still images, fewer effects) or reduced
// (the user asked for less motion: fades only). Lite is chosen automatically on weak devices or by hand.
import { useEffect, useState } from 'react';
import { useUi } from '../stores/ui';

export type MotionMode = 'full' | 'lite' | 'reduced';

let lowEnd: boolean | null = null;

/** Cheap capability check, run once: data saver, little memory or few cores, or no WebGL. */
export function deviceIsLowEnd(): boolean {
  if (lowEnd !== null) return lowEnd;
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let weak = !!n.connection?.saveData || (n.deviceMemory ?? 8) <= 2 || (n.hardwareConcurrency ?? 8) <= 2;
  if (!weak) {
    try {
      const c = document.createElement('canvas');
      weak = !(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      weak = true;
    }
  }
  lowEnd = weak;
  return weak;
}

const reducedQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');

let probed = false;

/**
 * Measures about a second of animation frames, after the page has settled (so loading work does not count).
 * Below 24 fps the device gets Lite mode. Runs at most once per page load, so turning Lite off sticks.
 */
export function probeFrameRate(onSlow: () => void) {
  if (probed) return () => {};
  let raf = 0;
  const wait = setTimeout(() => {
    // Marked here, not above, so React StrictMode's mount-unmount-mount in dev does not cancel the only run.
    probed = true;
    let frames = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - start < 1200) raf = requestAnimationFrame(tick);
      else if ((frames * 1000) / (now - start) < 24) onSlow();
    };
    raf = requestAnimationFrame(tick);
  }, 3000);
  return () => {
    clearTimeout(wait);
    cancelAnimationFrame(raf);
  };
}

export function useMotionMode(): MotionMode {
  const lite = useUi((s) => s.lite);
  const setLite = useUi((s) => s.setLite);
  const [reduced, setReduced] = useState(() => reducedQuery().matches);
  useEffect(() => {
    const q = reducedQuery();
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  // Probe once while 3D would be used; a slow result switches to Lite (the user can switch back in the menu).
  useEffect(() => {
    if (reduced || lite || deviceIsLowEnd()) return;
    return probeFrameRate(() => setLite(true));
  }, [reduced, lite, setLite]);
  if (reduced) return 'reduced';
  if (lite || deviceIsLowEnd()) return 'lite';
  return 'full';
}
