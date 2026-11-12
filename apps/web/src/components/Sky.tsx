// A sky that matches the forecast: sun shimmer when clear, drifting clouds, and rain particles on a canvas.
// Decorative only (aria-hidden). Static under reduced motion or Lite mode; pauses when off screen.
import { useEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/effects';
import { useUi } from '../stores/ui';
import type { Condition } from '../lib/weather';

const GRADIENT: Record<Condition, string> = {
  clear: 'linear-gradient(180deg, #8db3c7 0%, #e3eef3 70%, #fbf1d3 100%)',
  cloudy: 'linear-gradient(180deg, #7f97a6 0%, #c4d3dc 75%, #e3eef3 100%)',
  showers: 'linear-gradient(180deg, #4a6b80 0%, #8db3c7 80%, #c4d3dc 100%)',
  heavy: 'linear-gradient(180deg, #24465a 0%, #3d6e8a 75%, #7f97a6 100%)',
};

export function Sky({ cond, children }: { cond: Condition; children?: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lite = useUi((s) => s.lite);
  const still = lite || prefersReducedMotion();
  const raining = cond === 'showers' || cond === 'heavy';

  useEffect(() => {
    const el = canvas.current;
    if (!el || still || !raining) return;
    const ctx = el.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = cond === 'heavy' ? 140 : 60;
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      v: 6 + Math.random() * 6,
      l: 8 + Math.random() * 10,
    }));
    let raf = 0;
    let visible = true;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(227,238,243,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.l);
        d.y += d.v;
        d.x -= 0.6;
        if (d.y > h) {
          d.y = -d.l;
          d.x = Math.random() * (w + 40);
        }
      }
      ctx.stroke();
      if (visible) raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting && !document.hidden;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });
    io.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [cond, raining, still]);

  return (
    <div className="relative isolate overflow-hidden rounded-lg" style={{ background: GRADIENT[cond] }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {cond === 'clear' && (
          <div
            className={`absolute -right-10 -top-10 h-48 w-48 rounded-full ${still ? '' : 'animate-[shimmer_6s_ease-in-out_infinite]'}`}
            style={{
              background: 'radial-gradient(circle, #fbf1d3 0%, #f2cf6b 35%, rgba(242,207,107,0) 70%)',
            }}
          />
        )}
        {cond !== 'clear' &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute h-16 rounded-full bg-white/60 blur-md ${still ? '' : 'animate-[drift_linear_infinite]'}`}
              style={{
                width: `${180 + i * 60}px`,
                top: `${10 + i * 18}%`,
                left: `${-10 + i * 35}%`,
                animationDuration: `${40 + i * 15}s`,
                animationDelay: `${-i * 12}s`,
                opacity: cond === 'heavy' ? 0.35 : 0.6,
              }}
            />
          ))}
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
