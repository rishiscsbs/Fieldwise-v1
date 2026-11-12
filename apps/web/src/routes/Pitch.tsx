// /pitch: a full-screen, keyboard-driven deck over one continuous 3D world.
// Arrow keys, space, Page Up/Down (clickers) move; F toggles full screen; P opens the presenter window.
import { forwardRef, lazy, Suspense, useCallback, useEffect } from 'react';
import { AnimatePresence, m, useIsPresent } from 'framer-motion';
import type { ComponentProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PublicMetricsDto } from '@fieldwise/shared';
import { useFmt } from '../lib/format';
import { api } from '../lib/api';
import { useMotionMode } from '../lib/motion-mode';
import { Still, STILLS } from '../landing/Stage';
import { story } from '../landing/story';
import { Architecture } from '../pitch/Architecture';
import { SLIDES } from '../pitch/slides';
import { usePitchSync } from '../pitch/sync';
import { Icon } from '../components/Icon';
import { CountUp } from '../components/CountUp';

const PitchWorld = lazy(() => import('../pitch/PitchWorld'));
const ease = [0.2, 0.8, 0.2, 1] as const;

export const openPresenter = () =>
  window.open('/pitch/presenter', 'fieldwise-presenter', 'width=1100,height=720');

function LiveNumbers() {
  const { t, num } = useFmt();
  // Polls so the counters move during the live demo as questions are answered.
  const q = useQuery({
    queryKey: ['public-metrics'],
    queryFn: () => api<PublicMetricsDto>('/public/metrics'),
    refetchInterval: 10_000,
  });
  const d = q.data;
  if (!d) return null;
  const items = [
    ['farmers', d.farmers],
    ['districts', d.districts],
    ['answered', d.questionsAnswered],
    ['reply', d.medianResponseHours ?? 0],
    ['alerts', d.alertsSent],
    ['pests', d.pestReports],
  ] as const;
  return (
    <div className="mt-6">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        {t('pitch.live')}
      </p>
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3">
        {items.map(([k, v]) => (
          <div key={k}>
            <dd className="num font-display text-3xl sm:text-4xl">
              <CountUp value={v} format={(n) => num(n, k === 'reply' ? 1 : 0)} />
            </dd>
            <dt className="text-sm text-fg-muted">{t(`pitch.numbers.${k}`)}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-fg-muted">{t('pitch.simulated')}</p>
    </div>
  );
}

/**
 * A slide that hides itself from assistive tech and input while it animates out.
 * Forwards its ref because AnimatePresence's popLayout measures the outgoing element.
 */
const SlidePanel = forwardRef<HTMLElement, ComponentProps<typeof m.section>>(function SlidePanel(props, ref) {
  const present = useIsPresent();
  // React 18 has no typed inert prop; as an empty-string attribute the browser still applies it.
  const inert = present ? {} : ({ inert: '' } as Record<string, string>);
  return <m.section ref={ref} {...props} aria-hidden={!present || undefined} {...inert} />;
});

export function Pitch() {
  const { t } = useFmt();
  const mode = useMotionMode();
  const { index, setIndex } = usePitchSync('deck');
  const slide = SLIDES[index]!;
  const quality = (navigator.hardwareConcurrency ?? 4) >= 8 ? 'high' : 'medium';

  const go = useCallback((d: number) => setIndex(index + d), [index, setIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(SLIDES.length - 1);
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      } else if (e.key.toLowerCase() === 'p') openPresenter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, setIndex]);

  // Without 3D, the scene still follows the slide for the stills and any later 3D load.
  useEffect(() => {
    story.scene = slide.scene;
  }, [slide]);

  useEffect(() => {
    document.title = `${t(`pitch.slides.${slide.id}.kicker`)} · ${t('pitch.title')}`;
  }, [slide, t]);

  const points = t(`pitch.slides.${slide.id}.points`, { returnObjects: true }) as string[];
  const arch = slide.id === 'architecture';

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink text-fg">
      <div aria-hidden="true" className="absolute inset-0">
        {mode === 'full' ? (
          <Suspense fallback={<Still src={STILLS[slide.still]} className="h-full w-full object-cover" />}>
            <PitchWorld slide={slide} quality={quality} />
          </Suspense>
        ) : (
          SLIDES.map((s, i) => (
            <div
              key={s.id}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: i === index ? 1 : 0 }}
            >
              <Still src={STILLS[s.still]} className="h-full w-full object-cover" />
            </div>
          ))
        )}
      </div>

      <main className="relative flex h-full items-end p-4 pb-24 sm:items-center sm:p-10">
        {/* popLayout: the outgoing slide leaves the layout at once, so fast clicker presses never queue up */}
        <AnimatePresence mode="popLayout">
          <SlidePanel
            key={slide.id}
            aria-roledescription="slide"
            aria-label={t('pitch.slideOf', { n: index + 1, total: SLIDES.length })}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, ease }}
            className={`max-h-full overflow-y-auto rounded-xl border border-line/60 bg-surface/90 p-6 shadow-3 backdrop-blur-md sm:p-10 ${arch ? 'w-full max-w-5xl' : 'max-w-2xl'}`}
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t(`pitch.slides.${slide.id}.kicker`)}
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-5xl">
              {t(`pitch.slides.${slide.id}.title`)}
            </h1>
            <ul className={`mt-6 grid gap-3 text-lg sm:text-xl ${arch ? 'md:grid-cols-3 md:text-base' : ''}`}>
              {points.map((p, i) => (
                <m.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.12, duration: 0.4 }}
                  className="flex gap-3"
                >
                  <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {p}
                </m.li>
              ))}
            </ul>
            {arch && (
              <div className="mt-6">
                <Architecture animate={mode !== 'reduced'} />
              </div>
            )}
            {slide.live && <LiveNumbers />}
          </SlidePanel>
        </AnimatePresence>
      </main>

      <nav
        aria-label={t('pitch.title')}
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-ink/70 to-transparent p-4 text-paper"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label={t('pitch.prev')}
            className="grid h-11 w-11 place-items-center rounded-full bg-paper/15 hover:bg-paper/25 disabled:opacity-40"
          >
            <Icon name="arrowLeft" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === SLIDES.length - 1}
            aria-label={t('pitch.next')}
            className="grid h-11 w-11 place-items-center rounded-full bg-paper/15 hover:bg-paper/25 disabled:opacity-40"
          >
            <Icon name="arrowRight" />
          </button>
          <span className="num ml-2 text-sm" aria-live="polite">
            {t('pitch.slideOf', { n: index + 1, total: SLIDES.length })}
          </span>
        </div>
        <ol className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIndex(i)}
                className={`block h-2 rounded-full transition-all duration-3 ${i === index ? 'w-8 bg-mustard-500' : 'w-2 bg-paper/50 hover:bg-paper'}`}
              />
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs opacity-80 lg:inline">{t('pitch.controls')}</span>
          <button
            type="button"
            onClick={openPresenter}
            aria-label={t('pitch.openPresenter')}
            className="grid h-11 w-11 place-items-center rounded-full bg-paper/15 hover:bg-paper/25"
          >
            <Icon name="desk" />
          </button>
        </div>
      </nav>
    </div>
  );
}
