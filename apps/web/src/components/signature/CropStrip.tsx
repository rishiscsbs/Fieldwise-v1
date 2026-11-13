// A row of crop photos. In full motion it is a Flex Carousel (cards flow through liquid glass at the edges);
// in Lite and reduced motion, and while the WebGL chunk loads, it is an ordinary scroll-snapping row.
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useRich } from './rich';

const FlexCarousel = lazy(() => import('../reactbits/FlexCarousel'));

export interface StripItem {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
}

interface Props {
  items: StripItem[];
  label: string;
  /** Height of the whole strip in px, captions included. Or size it with height classes instead. */
  height?: number;
  onSelect?: (index: number) => void;
  className?: string;
}

export function CropStrip({ items, label, height, onSelect, className = '' }: Props) {
  const rich = useRich();
  const { t } = useTranslation('app');
  const row = (
    <ul
      aria-label={label}
      className="flex h-full snap-x snap-mandatory items-center gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]"
    >
      {items.map((it, i) => (
        <li key={it.src} className="h-[78%] shrink-0 snap-center">
          <figure className="flex h-full flex-col gap-2">
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="h-full overflow-hidden rounded-xl shadow-2"
              >
                <img
                  src={it.src}
                  alt={it.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-auto object-cover"
                />
              </button>
            ) : (
              <img
                src={it.src}
                alt={it.alt}
                loading="lazy"
                decoding="async"
                className="h-full w-auto rounded-xl object-cover shadow-2"
              />
            )}
            <figcaption className="text-center text-sm font-semibold">
              {it.title}
              {it.subtitle && <span className="block font-normal text-fg-muted">{it.subtitle}</span>}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={className} style={height ? { height } : undefined}>
      {rich ? (
        <Suspense fallback={row}>
          <FlexCarousel
            items={items}
            ariaLabel={label}
            positionLabel={(i, n) => t('fx.position', { i: i + 1, n })}
            captureWheel={false}
            focusOnClick={false}
            onSelect={onSelect ? (i) => onSelect(i) : undefined}
            cardHeight={0.62}
            radius={20}
            gap={16}
            className="text-fg"
          />
        </Suspense>
      ) : (
        row
      )}
    </div>
  );
}
