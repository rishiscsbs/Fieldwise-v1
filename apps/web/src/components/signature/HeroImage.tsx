// A full-bleed photo that breaks into blocks under the cursor and settles back (Grid Distortion). For the
// landing hero and the login screen only, never behind data. The plain <img> is always rendered underneath:
// it is the Lite and reduced-motion version, the loading state, and what paints first.
import { lazy, Suspense } from 'react';
import { useRich } from './rich';

const GridDistortion = lazy(() => import('../reactbits/GridDistortion'));

// React 18 does not know fetchPriority yet, so pass the attribute as the browser spells it.
const HIGH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>;

interface Props {
  src: string;
  /** Empty for decorative photos (the usual case: the hero text says what matters). */
  alt?: string;
  className?: string;
}

export function HeroImage({ src, alt = '', className = '' }: Props) {
  const rich = useRich();
  return (
    // The caller positions it (absolute inset-0 behind a hero, or relative with a height).
    <div className={`isolate overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        decoding="async"
        {...HIGH_PRIORITY}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {rich && (
        <Suspense fallback={null}>
          <div aria-hidden="true" className="absolute inset-0">
            <GridDistortion imageSrc={src} grid={18} radius={0.16} strength={0.14} idle={0.25} chroma={0.4} />
          </div>
        </Suspense>
      )}
    </div>
  );
}
