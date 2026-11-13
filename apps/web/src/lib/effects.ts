// Small delights, loaded only when used and skipped for reduced motion or Lite mode.
import { useUi } from '../stores/ui';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const calm = () => prefersReducedMotion() || useUi.getState().lite;

/** Brand colours for bursts: leaf, mustard, monsoon, soil. */
const BURST = ['#3e9b55', '#d9a21b', '#9bd18f', '#3d6e8a', '#c9a487'];

export interface BurstLook {
  colors: string[];
  /** Puffs (cotton) are big and round; grains are small. */
  scalar?: number;
  shapes?: ('circle' | 'square')[];
}

/** A short buzz on Android for key actions (where the browser supports it). Never for reduced motion. */
export function haptic(pattern: number | number[] = 12) {
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some WebViews throw when vibration is blocked; it is only a nicety.
  }
}

/** A seed-and-petal burst from an element (or the centre of the screen), optionally in a crop's colours. */
export async function burst(from?: Element | null, look?: BurstLook) {
  if (calm()) return;
  const { default: confetti } = await import('canvas-confetti');
  const r = from?.getBoundingClientRect();
  const origin = r
    ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
    : { x: 0.5, y: 0.5 };
  void confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    gravity: 1.1,
    scalar: look?.scalar ?? 0.9,
    ticks: 160,
    origin,
    colors: look?.colors ?? BURST,
    shapes: look?.shapes ?? ['circle', 'square'],
    disableForReducedMotion: true,
  });
}
