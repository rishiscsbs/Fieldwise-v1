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

/**
 * A paper plane that lifts off from an element (the send button) and flies up and away. Drawn in code and
 * animated with the Web Animations API, so it costs nothing until used. Skipped in Lite and reduced motion.
 */
export function flyPlane(from?: Element | null) {
  if (calm() || !from) return;
  const r = from.getBoundingClientRect();
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `position:fixed;left:${r.left + r.width / 2 - 18}px;top:${r.top + r.height / 2 - 18}px;width:36px;height:36px;z-index:60;pointer-events:none;color:var(--primary)`;
  el.innerHTML =
    '<svg viewBox="0 0 36 36" width="36" height="36"><path d="M3 17 33 4 24 32l-7-10Z" fill="var(--surface)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M33 4 17 22l-2 9 5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  document.body.appendChild(el);
  const dx = Math.min(window.innerWidth - r.right + 80, 420);
  const anim = el.animate(
    [
      { transform: 'translate(0,0) rotate(0deg) scale(.6)', opacity: 0 },
      { transform: 'translate(-12px,6px) rotate(-8deg) scale(1)', opacity: 1, offset: 0.15 },
      { transform: `translate(${dx * 0.45}px,-90px) rotate(-18deg) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px,-260px) rotate(-30deg) scale(.7)`, opacity: 0 },
    ],
    { duration: 1100, easing: 'cubic-bezier(.4,0,.2,1)' },
  );
  anim.onfinish = anim.oncancel = () => el.remove();
}
