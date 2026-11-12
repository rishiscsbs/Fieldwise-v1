// Renders one frozen frame of the 3D world full screen, for scripts/capture-stills.mjs to photograph.
// Visit /?still=kharif|rabi|zaid|soil. Sets window.__stillReady once the frame has settled.
import { lazy, Suspense, useEffect } from 'react';
import { setStill, type SeasonId } from './story';

const World = lazy(() => import('./World'));

declare global {
  interface Window {
    __stillReady?: boolean;
  }
}

export function StillCapture({ still }: { still: SeasonId | 'soil' }) {
  setStill(still);
  useEffect(() => {
    // Give shaders, bloom and a few animation frames time to settle.
    const id = setTimeout(() => (window.__stillReady = true), 2500);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="fixed inset-0">
      <Suspense fallback={null}>
        <World quality="high" still={still} />
      </Suspense>
    </div>
  );
}
