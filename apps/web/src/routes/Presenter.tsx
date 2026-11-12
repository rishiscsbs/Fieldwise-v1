// /pitch/presenter: speaker notes, what is next, and a timer, kept in step with the deck via BroadcastChannel.
import { useEffect, useRef, useState } from 'react';
import { useFmt } from '../lib/format';
import { SLIDES } from '../pitch/slides';
import { usePitchSync } from '../pitch/sync';
import { Icon } from '../components/Icon';
import { Badge } from '../components/ui';

function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const started = useRef<number | null>(null);
  const base = useRef(0);
  useEffect(() => {
    if (!running) return;
    started.current = Date.now();
    const id = setInterval(() => setElapsed(base.current + (Date.now() - started.current!)), 250);
    return () => {
      clearInterval(id);
      base.current += Date.now() - (started.current ?? Date.now());
    };
  }, [running]);
  const reset = () => {
    base.current = 0;
    started.current = Date.now();
    setElapsed(0);
  };
  return { elapsed, running, toggle: () => setRunning((r) => !r), reset };
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function Presenter() {
  const { t } = useFmt();
  const { index, setIndex, peer } = usePitchSync('presenter');
  const timer = useTimer();
  const slide = SLIDES[index]!;
  const next = SLIDES[index + 1];

  useEffect(() => {
    document.title = t('pitch.presenter');
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        setIndex(index + 1);
      }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        setIndex(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, setIndex, t]);

  return (
    <div className="min-h-dvh bg-bg p-4 sm:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl">{t('pitch.presenter')}</h1>
        {peer ? (
          <Badge tone="good">{t('pitch.p.connected')}</Badge>
        ) : (
          <p className="text-sm text-fg-muted">{t('pitch.p.waiting')}</p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card" aria-live="polite">
          <p className="text-sm font-semibold text-fg-muted">
            {t('pitch.p.now')} · {t('pitch.slideOf', { n: index + 1, total: SLIDES.length })}
          </p>
          <h2 className="mt-1 font-display text-3xl">{t(`pitch.slides.${slide.id}.title`)}</h2>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            {t('pitch.p.notes')}
          </h3>
          <p className="mt-2 text-xl leading-relaxed">{t(`pitch.slides.${slide.id}.notes`)}</p>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card text-center">
            <h3 className="text-sm font-semibold text-fg-muted">{t('pitch.p.timer')}</h3>
            <p className="num font-display text-6xl" role="timer">
              {clock(timer.elapsed)}
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" className="btn-primary" onClick={timer.toggle}>
                {timer.running ? t('pitch.p.pause') : t('pitch.p.start')}
              </button>
              <button type="button" className="btn-secondary" onClick={timer.reset}>
                {t('pitch.p.reset')}
              </button>
            </div>
          </section>
          <section className="card">
            <h3 className="text-sm font-semibold text-fg-muted">{t('pitch.p.upNext')}</h3>
            <p className="mt-1 text-lg font-semibold">
              {next ? t(`pitch.slides.${next.id}.title`) : t('pitch.p.end')}
            </p>
          </section>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setIndex(index - 1)}
              disabled={index === 0}
            >
              <Icon name="arrowLeft" size={18} />
              {t('pitch.prev')}
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => setIndex(index + 1)}
              disabled={!next}
            >
              {t('pitch.next')}
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </div>
      </div>

      <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {SLIDES.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
              className={`w-full rounded-md border p-3 text-left text-sm ${i === index ? 'border-primary bg-accent-soft font-semibold' : 'border-line bg-surface hover:bg-surface-2'}`}
            >
              <span className="num text-fg-muted">{i + 1}. </span>
              {t(`pitch.slides.${s.id}.kicker`)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
