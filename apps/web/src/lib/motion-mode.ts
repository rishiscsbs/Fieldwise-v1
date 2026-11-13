// How much motion to use: full (3D, smooth scroll), lite (still images, fewer effects) or reduced
// (the user asked for less motion: fades only). Lite is chosen automatically on weak devices or by hand.
import { useEffect, useState } from 'react';
import { useUi } from '../stores/ui';

export type MotionMode = 'full' | 'lite' | 'reduced';

/** Free check: data saver on, little memory or few cores. */
export function weakHardware(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return !!n.connection?.saveData || (n.deviceMemory ?? 8) <= 2 || (n.hardwareConcurrency ?? 8) <= 2;
}

let webgl: boolean | null = null;

/**
 * Whether WebGL works here, checked once. Creating a context is slow (more so with software rendering), so only
 * call this where WebGL is about to be used, never on the way to a page's first paint.
 */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Weak hardware or no WebGL. For pages that mount 3D straight away (landing, pitch, planner's 3D view). */
export function deviceIsLowEnd(): boolean {
  return weakHardware() || !hasWebGL();
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

/**
 * Motion for 2D effects (weather, wheels, map pulses, the signature wrappers' layout): the same reduced and
 * Lite rules, but without the WebGL check or the frame-rate probe, so it costs nothing on the way to first paint.
 */
export function useEffectsMode(): MotionMode {
  const lite = useUi((s) => s.lite);
  const [reduced, setReduced] = useState(() => reducedQuery().matches);
  useEffect(() => {
    const q = reducedQuery();
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  if (reduced) return 'reduced';
  if (lite || weakHardware()) return 'lite';
  return 'full';
}
