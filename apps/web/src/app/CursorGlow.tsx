import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/effects';
import { useUi } from '../stores/ui';

/** A soft glow that trails the mouse. Desktop pointers only; off for reduced motion and Lite mode. */
export function CursorGlow() {
  const el = useRef<HTMLDivElement>(null);
  const lite = useUi((s) => s.lite);
  useEffect(() => {
    if (lite || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    const target = { x: -500, y: -500 };
    const pos = { ...target };
    let raf = 0;
    const move = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
    };
    const tick = () => {
      pos.x += (target.x - pos.x) * 0.12;
      pos.y += (target.y - pos.y) * 0.12;
      if (el.current) el.current.style.transform = `translate3d(${pos.x - 200}px, ${pos.y - 200}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, [lite]);
  if (lite) return null;
  return (
    <div
      ref={el}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 hidden h-[400px] w-[400px] rounded-full opacity-60 [@media(pointer:fine)]:block motion-reduce:!hidden"
      style={{
        background:
          'radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 65%)',
      }}
    />
  );
}
