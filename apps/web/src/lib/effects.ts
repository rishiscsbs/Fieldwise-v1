// Small delights, loaded only when used and skipped for reduced motion or Lite mode.
import { useUi } from '../stores/ui';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const calm = () => prefersReducedMotion() || useUi.getState().lite;

/** Brand colours for bursts: leaf, mustard, monsoon, soil. */
const BURST = ['#3e9b55', '#d9a21b', '#9bd18f', '#3d6e8a', '#c9a487'];

export interface BurstLook {
  colors: string[];
  /** Puffs (cotton) are big and round; grains are small. */
  scalar?: number;
  shapes?: ('circle' | 'square')[];
}

/**
 * Each crop bursts in its own colours: golden grains for wheat, white puffs for cotton, red for tomato and so
 * on. Crops not listed use the brand burst.
 */
export const CROP_BURST: Partial<Record<string, BurstLook>> = {
  wheat: { colors: ['#e0a815', '#f2cf6b', '#c9930f', '#f7e3a1'], scalar: 0.7, shapes: ['circle'] },
  rice: { colors: ['#9bd18f', '#3e9b55', '#e9dfa8', '#f2cf6b'], scalar: 0.7 },
  maize: { colors: ['#f2b705', '#f7d046', '#e08e0b', '#3e9b55'], scalar: 0.8, shapes: ['circle'] },
  cotton: { colors: ['#ffffff', '#f6f1e7', '#ece4d4'], scalar: 1.5, shapes: ['circle'] },
  sugarcane: { colors: ['#6aa84f', '#b6d7a8', '#8e7cc3'], scalar: 0.9, shapes: ['square'] },
  soybean: { colors: ['#d9c27a', '#9bd18f', '#a67c52'], scalar: 0.8, shapes: ['circle'] },
  groundnut: { colors: ['#c9a487', '#8a5a3b', '#f1e6da'], scalar: 0.9, shapes: ['circle'] },
  chickpea: { colors: ['#c8a165', '#e3c48f', '#8a5a3b'], scalar: 0.8, shapes: ['circle'] },
  mustard: { colors: ['#f2cf6b', '#f7e15a', '#d9a21b', '#9bd18f'], scalar: 0.8 },
  tur: { colors: ['#e0a815', '#9bd18f', '#a67c52'], scalar: 0.8, shapes: ['circle'] },
  tomato: { colors: ['#d7372b', '#f05a46', '#b5221a', '#3e9b55'], scalar: 1.1, shapes: ['circle'] },
  potato: { colors: ['#c9a487', '#e6cba8', '#8a5a3b'], scalar: 1.1, shapes: ['circle'] },
};

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

/**
 * A paper plane that lifts off from an element (the send button) and flies up and away. Drawn in code and
 * animated with the Web Animations API, so it costs nothing until used. Skipped in Lite and reduced motion.
 */
export function flyPlane(from?: Element | null) {
  haptic(10);
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

/**
 * The Easter egg: rain falls across the whole app for a few seconds. A fixed canvas above everything that
 * ignores the pointer, drawn in the season's blue, fading in and out. Skipped in Lite and reduced motion.
 * Returns false when skipped, so the caller can still acknowledge it.
 */
export function makeItRain(ms = 5000): boolean {
  if (calm()) return false;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;z-index:70;pointer-events:none;opacity:0;transition:opacity .6s';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return false;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--season-b').trim() || '#3d6e8a';
  const drops = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    v: 9 + Math.random() * 8,
    l: 14 + Math.random() * 14,
  }));
  const splashes: { x: number; y: number; r: number }[] = [];
  let raf = 0;
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3, d.y + d.l);
      d.y += d.v;
      d.x -= 1;
      if (d.y > h) {
        if (Math.random() < 0.3) splashes.push({ x: d.x, y: h - 2, r: 1 });
        d.y = -d.l;
        d.x = Math.random() * (w + 60);
      }
    }
    ctx.stroke();
    // Little splash rings along the bottom edge.
    ctx.globalAlpha = 0.35;
    for (let i = splashes.length - 1; i >= 0; i--) {
      const sp = splashes[i]!;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, sp.r * 2, sp.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      sp.r += 0.5;
      if (sp.r > 8) splashes.splice(i, 1);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  requestAnimationFrame(() => (canvas.style.opacity = '1'));
  setTimeout(() => (canvas.style.opacity = '0'), Math.max(0, ms - 600));
  setTimeout(() => {
    cancelAnimationFrame(raf);
    canvas.remove();
  }, ms);
  return true;
}
