// The signature pieces (React Bits) only run in full motion mode. Lite mode and reduced motion get the plain
// fallback each wrapper provides, and the WebGL chunk is never downloaded.
//
// Even in full motion they wait for the person's first interaction (pointer, touch, key or scroll). Every one
// of them responds to the pointer anyway, and holding them back keeps shader compiles and extra chunks out of
// the first load: the plain version (photo, word, button) is what paints first.
import { useSyncExternalStore } from 'react';
import { hasWebGL, useEffectsMode } from '../../lib/motion-mode';

let woken = false;
const subscribers = new Set<() => void>();
const EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'] as const;

function wake() {
  if (woken) return;
  woken = true;
  for (const e of EVENTS) window.removeEventListener(e, wake, true);
  subscribers.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  for (const e of EVENTS) window.addEventListener(e, wake, { capture: true, passive: true });
}

const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

/**
 * True once the piece may run: full motion and the first interaction has happened. Pieces drawn with WebGL
 * (Grid Distortion, Flex Carousel, Specular Button) pass `{ webgl: true }`; WebGL support is only checked
 * then, after load, because creating a context to find out is slow.
 */
export const useRich = ({ webgl = false }: { webgl?: boolean } = {}) => {
  const full = useEffectsMode() === 'full';
  const awake = useSyncExternalStore(
    subscribe,
    () => woken,
    () => false,
  );
  return full && awake && (!webgl || hasWebGL());
};

/** Reads a colour token as a concrete value, for canvas code that cannot resolve var(). */
export function tokenColour(name: string, fallback = '#000000'): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || fallback;
}
