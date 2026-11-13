// Weather you can feel behind a header: light rain streaks when rain is due, a faint heat shimmer on a hot day,
// a soft sun glow on a clear morning. Decorative (aria-hidden), drawn in season colours, and switched off in
// Lite mode and for reduced motion (a still glow is all that remains). Rain pauses when off screen.
import { useEffect, useRef } from 'react';
import { useMotionMode } from '../lib/motion-mode';
import type { Condition } from '../lib/weather';

interface Props {
  cond: Condition;
  hot?: boolean;
  morning?: boolean;
}

function Rain({ heavy }: { heavy: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
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
    // Streak colour follows the season's slate/blue, read once per mount.
    const ink = getComputedStyle(el).color;
    const drops = Array.from({ length: heavy ? 110 : 55 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      v: 5 + Math.random() * 5,
      l: 10 + Math.random() * 12,
    }));
    let raf = 0;
    let visible = true;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = heavy ? 0.45 : 0.32;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 3, d.y + d.l);
        d.y += d.v;
        d.x -= 0.8;
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
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [heavy]);
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full text-season-b" />;
}

export function WeatherFx({ cond, hot = false, morning = false }: Props) {
  const full = useMotionMode() === 'full';
  const raining = cond === 'showers' || cond === 'heavy';
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {cond === 'clear' && (
        <div
          className={`absolute -right-12 -top-20 h-48 w-48 rounded-full sm:-right-16 sm:-top-24 sm:h-72 sm:w-72 ${full ? 'animate-[shimmer_7s_ease-in-out_infinite]' : ''}`}
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 65%)',
            opacity: morning ? 0.55 : 0.35,
          }}
        />
      )}
      {cond !== 'clear' && (
        <div className="absolute inset-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute h-16 rounded-full bg-surface blur-xl ${full ? 'animate-[drift_linear_infinite]' : ''}`}
              style={{
                width: `${200 + i * 70}px`,
                top: `${4 + i * 22}%`,
                left: `${-5 + i * 30}%`,
                animationDuration: `${50 + i * 18}s`,
                animationDelay: `${-i * 14}s`,
                opacity: cond === 'heavy' ? 0.35 : 0.5,
              }}
            />
          ))}
        </div>
      )}
      {full && raining && <Rain heavy={cond === 'heavy'} />}
      {full && hot && (
        <div className="absolute inset-x-0 bottom-0 h-2/3 animate-[heat_5s_ease-in-out_infinite] opacity-40 [background:repeating-linear-gradient(180deg,transparent_0_14px,var(--season-b)_15px,transparent_17px)] [mask-image:linear-gradient(to_top,black,transparent)]" />
      )}
    </div>
  );
}
