// The fixed backdrop behind the landing story. Full mode: the live 3D world (loaded on demand).
// Lite mode: still frames of the same world, cross-faded by season. Reduced motion never uses the stage.
import { lazy, Suspense, useEffect, useState } from 'react';
import type { MotionMode } from '../lib/motion-mode';
import { SEASON_IDS, type SeasonId } from './story';

const World = lazy(() => import('./World'));

export type StageView = 'farm' | 'soil' | 'none';

/** Still frames rendered from the 3D world by scripts/capture-stills.mjs. */
export const STILLS: Record<SeasonId | 'soil', string> = {
  kharif: '/lite/kharif.jpg',
  rabi: '/lite/rabi.jpg',
  zaid: '/lite/zaid.jpg',
  soil: '/lite/soil.jpg',
};

/** A still image that quietly disappears if it has not been generated yet. */
export function Still({ src, className = '', alt = '' }: { src: string; className?: string; alt?: string }) {
  const [ok, setOk] = useState(true);
  return ok ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      className={className}
    />
  ) : null;
}

/**
 * The photo hero covers the stage on arrival, so three.js waits for the first scroll or an idle moment instead
 * of competing with the hero for the first paint.
 */
function useArmed() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2500));
    const id = idle(arm, { timeout: 4000 });
    window.addEventListener('scroll', arm, { once: true, passive: true });
    return () => {
      (window.cancelIdleCallback ?? window.clearTimeout)(id);
      window.removeEventListener('scroll', arm);
    };
  }, [armed]);
  return armed;
}

export function Stage({ mode, view, season }: { mode: MotionMode; view: StageView; season: number }) {
  const quality = (navigator.hardwareConcurrency ?? 4) >= 8 ? 'high' : 'medium';
  const armed = useArmed();
  const active = view === 'soil' ? 'soil' : (SEASON_IDS[Math.min(2, Math.round(season))] ?? 'kharif');
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-monsoon-300 transition-opacity duration-700"
      style={{ opacity: view === 'none' ? 0 : 1 }}
    >
      {mode === 'full' && !armed ? (
        <Still src={STILLS.kharif} className="h-full w-full object-cover" />
      ) : mode === 'full' ? (
        <Suspense fallback={<Still src={STILLS.kharif} className="h-full w-full object-cover" />}>
          <World quality={quality} paused={view === 'none'} />
        </Suspense>
      ) : (
        (Object.keys(STILLS) as (keyof typeof STILLS)[]).map((k) => (
          <div
            key={k}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: k === active ? 1 : 0 }}
          >
            <Still src={STILLS[k]} className="h-full w-full object-cover" />
          </div>
        ))
      )}
    </div>
  );
}
