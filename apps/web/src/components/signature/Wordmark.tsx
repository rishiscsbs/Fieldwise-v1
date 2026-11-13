// The Fieldwise wordmark for brand moments (landing hero, login, pitch title): letters turn into dashed vector
// paths under the cursor (Tech Text). Never for body text or ordinary headings. The fallback is the same word
// set in the display face, so nothing shifts when the canvas takes over.
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSeason } from '../../lib/season';
import { useUi } from '../../stores/ui';
import { tokenColour, useRich } from './rich';

const TechText = lazy(() => import('../reactbits/TechText'));

interface Props {
  /** Largest font size in px; it shrinks to fit narrow containers. */
  size?: number;
  align?: 'left' | 'center';
  className?: string;
}

export function Wordmark({ size = 120, align = 'left', className = '' }: Props) {
  const rich = useRich();
  const { t } = useTranslation('app');
  // Re-read the accent when the season or theme changes; canvas code cannot follow CSS variables.
  const season = useSeason();
  const theme = useUi((s) => s.theme);
  const [accent, setAccent] = useState('#d9a21b');
  useEffect(() => {
    // After the season sweep has swapped data-season on <html>.
    const id = setTimeout(() => setAccent(tokenColour('accent', '#d9a21b')), 60);
    return () => clearTimeout(id);
  }, [season, theme]);
  const word = t('brand');
  // Shrink to the container: Baloo 2 at weight 800 averages about 0.56 em per letter.
  const wrap = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(size);
  // Measured before the first paint, so the word never shows big and then shrinks (that would shift the page).
  // One direct read here (it forces a layout, so only once); after that the observer hands over the width, which
  // costs nothing. Only the width matters, so the height change from a new fit does not trigger another round.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fitFor = (width: number) => Math.max(24, Math.min(size, Math.floor(width / (word.length * 0.56))));
    setFit(fitFor(el.clientWidth));
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? lastWidth);
      if (width === lastWidth) return;
      lastWidth = width;
      setFit(fitFor(width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size, word]);
  const box = { height: Math.round(fit * 1.15) };
  const plain = (
    <span
      className={`block font-display font-extrabold leading-none ${align === 'center' ? 'text-center' : ''}`}
      style={{ fontSize: fit, lineHeight: `${box.height}px` }}
    >
      {word}
    </span>
  );
  return (
    <span ref={wrap} className={`block ${className}`} style={box}>
      {rich ? (
        <Suspense fallback={plain}>
          <TechText
            text={word}
            fontFamily="'Baloo 2', 'Mukta', sans-serif"
            fontWeight={800}
            fontSize={fit}
            letterSpacing={-0.03}
            align={align}
            color="currentColor"
            accentColor={accent}
            labels={false}
            selection={false}
            reach={Math.round(fit * 1.4)}
            intro="assemble"
            introDuration={1.4}
          />
        </Suspense>
      ) : (
        plain
      )}
    </span>
  );
}
