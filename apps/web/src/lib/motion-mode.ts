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

export function useMotionMode(): MotionMode {
  const lite = useUi((s) => s.lite);
  const [reduced, setReduced] = useState(() => reducedQuery().matches);
  useEffect(() => {
    const q = reducedQuery();
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  if (reduced) return 'reduced';
  if (lite || deviceIsLowEnd()) return 'lite';
  return 'full';
}
