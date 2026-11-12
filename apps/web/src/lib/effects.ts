// Small delights, loaded only when used and skipped for reduced motion or Lite mode.
import { useUi } from '../stores/ui';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const calm = () => prefersReducedMotion() || useUi.getState().lite;

/** Brand colours for bursts: leaf, mustard, monsoon, soil. */
const BURST = ['#3e9b55', '#d9a21b', '#9bd18f', '#3d6e8a', '#c9a487'];

/** A seed-and-petal burst from an element (or the centre of the screen). */
export async function burst(from?: Element | null) {
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
    scalar: 0.9,
    ticks: 160,
    origin,
    colors: BURST,
    shapes: ['circle', 'square'],
    disableForReducedMotion: true,
  });
}
