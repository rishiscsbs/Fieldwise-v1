// The signature pieces (React Bits) only run in full motion mode. Lite mode and reduced motion get the plain
// fallback each wrapper provides, and the WebGL chunk is never downloaded.
import { useMotionMode } from '../../lib/motion-mode';

export const useRich = () => useMotionMode() === 'full';

/** Reads a colour token as a concrete value, for canvas code that cannot resolve var(). */
export function tokenColour(name: string, fallback = '#000000'): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || fallback;
}
