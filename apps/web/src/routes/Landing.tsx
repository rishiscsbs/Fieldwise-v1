// The landing page: a scroll story over a 3D farm (Full), still frames (Lite) or a calm stacked page
// (reduced motion). All copy is translated; all numbers come from the live API.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { m, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import type { PublicMetricsDto } from '@fieldwise/shared';
import { useAuth } from '../stores/auth';
import { useFmt } from '../lib/format';
import { api } from '../lib/api';
import { useReference } from '../lib/queries';
import { useMotionMode, type MotionMode } from '../lib/motion-mode';
import { PublicHeader } from '../components/PublicHeader';
import { CountUp } from '../components/CountUp';
import { Icon } from '../components/Icon';
import { IndiaMap } from '../maps/IndiaMap';
import { Stage, STILLS, Still } from '../landing/Stage';
import { useScrollStory } from '../landing/useScrollStory';
import { SEASON_IDS } from '../landing/story';
import { StillCapture } from '../landing/StillCapture';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Headline words rise in one after another. */
function Kinetic({ text, className }: { text: string; className?: string }) {
  return (
    <h1 className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <m.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.7, ease }}
          >
            {w}&nbsp;
          </m.span>
        </span>
      ))}
    </h1>
  );
}

/** Fades content up when it scrolls into view (the only motion kept under reduced motion). */
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-15% 0px' }}
      transition={{ duration: 0.6, delay, ease }}
    >
      {children}
    </m.div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{children}</p>;
}

/** A readable panel floating over the 3D stage. */
const panel = 'rounded-xl border border-line/60 bg-surface/85 p-6 shadow-2 backdrop-blur-md sm:p-8';

function Hero({ mode }: { mode: MotionMode }) {
  const { t } = useFmt();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return (
    <section id="hero" className="relative flex min-h-[100svh] items-end pb-16 pt-28 sm:items-center sm:pb-0">
      {mode === 'reduced' && (
        <Still src={STILLS.kharif} className="absolute inset-0 -z-10 h-full w-full object-cover" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-[5] bg-gradient-to-t from-bg via-bg/40 to-transparent sm:bg-gradient-to-r sm:from-bg/90 sm:via-bg/50"
      />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <div className="max-w-2xl">
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary"
          >
            {t('landing.heroKicker')}
          </m.p>
          <Kinetic
            text={t('landing.heroTitle')}
            className="font-display text-4xl leading-[1.08] sm:text-6xl"
          />
          {/* Visible from the first frame (it is the largest text, so a fade would delay LCP); it only slides. */}
          <m.p
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-5 max-w-xl text-lg text-fg"
          >
            {t('landing.heroLead')}
          </m.p>
          <m.div
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link to={signedIn ? '/app' : '/login'} className="btn-primary px-6 text-lg">
              {t('landing.open')}
              <Icon name="arrowRight" size={18} />
            </Link>
            <a href="#seasons" className="btn-secondary px-6 text-lg">
              {t('landing.how')}
            </a>
          </m.div>
        </div>
      </div>
      {mode !== 'reduced' && (
        <m.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{ delay: 1.6, y: { repeat: Infinity, duration: 2 } }}
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-sm text-fg-muted sm:block"
        >
          {t('landing.scroll')} ↓
        </m.div>
      )}
    </section>
  );
}

function Seasons({ mode, panel: active }: { mode: MotionMode; panel: number }) {
  const { t } = useFmt();
  if (mode === 'reduced') {
    return (
      <section id="seasons" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <Kicker>{t('landing.seasonsKicker')}</Kicker>
        <div className="grid gap-4 md:grid-cols-3">
          {SEASON_IDS.map((s) => (
            <Reveal key={s} className="card overflow-hidden p-0">
              <Still src={STILLS[s]} className="aspect-video w-full object-cover" />
              <div className="p-5">
                <h2 className="font-display text-3xl">{t(`landing.seasons.${s}.name`)}</h2>
                <p className="text-sm font-semibold text-fg-muted">{t(`landing.seasons.${s}.months`)}</p>
                <p className="mt-2">{t(`landing.seasons.${s}.body`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section id="seasons" className="relative h-[320vh]">
      <div className="sticky top-0 flex h-[100svh] items-end pb-10 sm:items-center sm:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
          <div className={`${panel} max-w-md`}>
            <Kicker>{t('landing.seasonsKicker')}</Kicker>
            <div className="relative min-h-[15rem] sm:min-h-[13rem]">
              {SEASON_IDS.map((s, i) => (
                <m.div
                  key={s}
                  className="absolute inset-0"
                  initial={false}
                  animate={{ opacity: i === active ? 1 : 0, y: i === active ? 0 : i < active ? -24 : 24 }}
                  transition={{ duration: 0.5, ease }}
                  aria-hidden={i !== active}
                >
                  <h2 className="font-display text-5xl">{t(`landing.seasons.${s}.name`)}</h2>
                  <p className="font-semibold text-fg-muted">{t(`landing.seasons.${s}.months`)}</p>
                  <p className="mt-3 text-lg">{t(`landing.seasons.${s}.body`)}</p>
                </m.div>
              ))}
            </div>
            <ol className="mt-4 flex gap-2" aria-hidden="true">
              {SEASON_IDS.map((s, i) => (
                <li
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-3 ${i <= active ? 'bg-primary' : 'bg-surface-2'}`}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function Soil({ mode }: { mode: MotionMode }) {
  const { t } = useFmt();
  const legend = [
    ['landing.soilN', 'bg-leaf-300'],
    ['landing.soilP', 'bg-monsoon-300'],
    ['landing.soilK', 'bg-mustard-300'],
  ] as const;
  const body = (
    <div className={`${panel} max-w-md`}>
      <Kicker>{t('landing.soilKicker')}</Kicker>
      <h2 className="font-display text-3xl sm:text-4xl">{t('landing.soilTitle')}</h2>
      <p className="mt-3">{t('landing.soilBody')}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {legend.map(([k, dot], i) => (
          <li key={k} className="flex items-center gap-3">
            <span aria-hidden="true" className="flex gap-0.5">
              {Array.from({ length: i * 2 + 1 }, (_, j) => (
                <span key={j} className={`h-2 w-2 rounded-full ${dot}`} />
              ))}
            </span>
            {t(k)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">{t('landing.soilNote')}</p>
    </div>
  );
  if (mode === 'reduced') {
    return (
      <section
        id="soil"
        className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-20 sm:px-8 md:grid-cols-2"
      >
        <Reveal>{body}</Reveal>
        <Reveal delay={0.1}>
          <Still src={STILLS.soil} className="w-full rounded-xl object-cover shadow-2" />
        </Reveal>
      </section>
    );
  }
  return (
    <section id="soil" className="relative mt-[40vh] h-[240vh]">
      <div className="sticky top-0 flex h-[100svh] items-end pb-10 sm:items-center sm:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">{body}</div>
      </div>
    </section>
  );
}

/** Field plots with irrigation channels that fill as you scroll. */
function Water() {
  const { t } = useFmt();
  const plots = [0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((c) => ({ x: 40 + c * 110, y: 40 + r * 90 })));
  return (
    <section id="water" className="bg-bg py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-8 md:grid-cols-2">
        <Reveal>
          <Kicker>{t('landing.waterKicker')}</Kicker>
          <h2 className="font-display text-3xl sm:text-5xl">{t('landing.waterTitle')}</h2>
          <p className="mt-4 text-lg text-fg-muted">{t('landing.waterBody')}</p>
        </Reveal>
        <svg viewBox="0 0 480 320" className="w-full" role="img" aria-label={t('landing.waterTitle')}>
          {plots.map((p, i) => (
            <rect
              key={i}
              x={p.x}
              y={p.y}
              width={90}
              height={70}
              rx={6}
              fill="var(--leaf-100)"
              stroke="var(--leaf-500)"
              strokeWidth={1.5}
            />
          ))}
          {/* Main canal, then branches between plot rows and columns */}
          <path
            data-draw
            d="M10 20 H470"
            stroke="var(--series-2)"
            strokeWidth={8}
            strokeLinecap="round"
            fill="none"
          />
          {[135, 245, 355].map((x) => (
            <path
              key={x}
              data-draw
              d={`M${x} 20 V300`}
              stroke="var(--series-2)"
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          ))}
          {[120, 210].map((y) => (
            <path
              key={y}
              data-draw
              d={`M30 ${y} H450`}
              stroke="var(--series-2)"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}

/** A road from the field to the mandi, with a truck that follows it on scroll. */
function Mandi() {
  const { t } = useFmt();
  return (
    <section id="mandi" className="bg-surface-2 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-8 md:grid-cols-2">
        <svg
          viewBox="0 0 480 300"
          className="order-2 w-full md:order-1"
          role="img"
          aria-label={t('landing.mandiTitle')}
        >
          <path
            id="mandi-road"
            data-draw
            d="M60 240 C 140 240, 150 90, 250 120 S 380 220, 420 70"
            stroke="var(--soil-500)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="1 0"
            fill="none"
          />
          <g>
            <rect
              x={20}
              y={210}
              width={80}
              height={60}
              rx={8}
              fill="var(--leaf-100)"
              stroke="var(--leaf-500)"
              strokeWidth={2}
            />
            {[224, 238, 252].map((y) => (
              <path
                key={y}
                d={`M30 ${y} h60`}
                stroke="var(--leaf-500)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="2 6"
              />
            ))}
            <text x={60} y={292} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text)">
              {t('landing.field')}
            </text>
          </g>
          <g>
            <rect
              x={380}
              y={30}
              width={80}
              height={56}
              rx={8}
              fill="var(--mustard-100)"
              stroke="var(--mustard-500)"
              strokeWidth={2}
            />
            <path
              d="M380 44 L420 18 L460 44"
              fill="var(--mustard-300)"
              stroke="var(--mustard-500)"
              strokeWidth={2}
            />
            <text x={420} y={108} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text)">
              {t('landing.mandi')}
            </text>
          </g>
          <g id="mandi-truck" transform="translate(60 240)">
            <rect x={-14} y={-12} width={20} height={12} rx={2} fill="var(--monsoon-700)" />
            <rect x={6} y={-9} width={9} height={9} rx={2} fill="var(--monsoon-500)" />
            <circle cx={-8} cy={1} r={3} fill="var(--ink)" />
            <circle cx={9} cy={1} r={3} fill="var(--ink)" />
          </g>
        </svg>
        <Reveal className="order-1 md:order-2">
          <Kicker>{t('landing.mandiKicker')}</Kicker>
          <h2 className="font-display text-3xl sm:text-5xl">{t('landing.mandiTitle')}</h2>
          <p className="mt-4 text-lg text-fg-muted">{t('landing.mandiBody')}</p>
        </Reveal>
      </div>
    </section>
  );
}

function Numbers() {
  const { t, num } = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-20% 0px' });
  const q = useQuery({
    queryKey: ['public-metrics'],
    queryFn: () => api<PublicMetricsDto>('/public/metrics'),
    staleTime: 60_000,
  });
  const d = q.data;
  const items = d
    ? ([
        ['districts', d.districts],
        ['farmers', d.farmers],
        ['acres', d.areaAcres],
        ['answered', d.questionsAnswered],
        ['crops', d.crops],
        ['pests', d.pests],
      ] as const)
    : [];
  return (
    <section id="numbers" className="bg-bg py-24">
      <div ref={ref} className="mx-auto max-w-6xl px-4 sm:px-8">
        <Kicker>{t('landing.numbersKicker')}</Kicker>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3">
          {items.map(([k, v], i) => (
            <m.div
              key={k}
              initial={{ opacity: 0, y: 16 }}
              animate={seen ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="border-t-2 border-primary pt-3"
            >
              <dd className="num font-display text-5xl sm:text-6xl">
                {seen ? <CountUp value={v} format={(n) => num(n)} duration={1400} /> : '0'}
              </dd>
              <dt className="mt-1 text-lg text-fg-muted">{t(`landing.numbers.${k}`)}</dt>
            </m.div>
          ))}
        </dl>
        <p className="mt-8 text-sm text-fg-muted">{t('landing.numbersNote')}</p>
      </div>
    </section>
  );
}

function MapSection() {
  const { t, label } = useFmt();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: '-20% 0px' });
  const reference = useReference();
  return (
    <section id="map" className="overflow-hidden bg-surface-2 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-8 md:grid-cols-[2fr_3fr]">
        <div id="map-title">
          <Kicker>{t('landing.mapKicker')}</Kicker>
          <h2 className="font-display text-3xl sm:text-5xl">{t('landing.mapTitle')}</h2>
          <p className="mt-4 text-lg text-fg-muted">{t('landing.mapBody')}</p>
        </div>
        <div id="map-art" ref={ref} className="min-h-[300px]">
          {seen && reference.data && (
            <IndiaMap
              label={t('landing.mapTitle')}
              maxHeight={520}
              fill="var(--surface)"
              pins={reference.data.districts.map((d) => ({
                id: d.id,
                lat: d.lat,
                lon: d.lon,
                label: label(d.labels).split(',')[0]!,
                highlight: true,
              }))}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  const { t } = useFmt();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  return (
    <section className="bg-leaf-900 py-24 text-paper">
      <Reveal className="mx-auto max-w-3xl px-4 text-center sm:px-8">
        <h2 className="font-display text-4xl sm:text-6xl">{t('landing.ctaTitle')}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-leaf-100">{t('landing.ctaBody')}</p>
        <Link
          to={signedIn ? '/app' : '/login'}
          className="btn mt-8 bg-mustard-500 px-8 text-lg text-ink hover:bg-mustard-300"
        >
          {t('landing.open')}
          <Icon name="arrowRight" size={18} />
        </Link>
      </Reveal>
    </section>
  );
}

export function Landing() {
  const [params] = useSearchParams();
  const still = params.get('still');
  if (still && (SEASON_IDS as readonly string[]).concat('soil').includes(still))
    return <StillCapture still={still as never} />;
  return <Story />;
}

function Story() {
  const { t } = useFmt();
  const mode = useMotionMode();
  const root = useRef<HTMLDivElement>(null);
  const { view, panel } = useScrollStory(root, mode);
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const [season, setSeason] = useState(0);
  useEffect(() => setSeason(panel), [panel]);

  return (
    <div ref={root} className="relative isolate">
      {mode !== 'reduced' && <Stage mode={mode} view={view} season={season} />}
      <div className="fixed inset-x-0 top-0 z-30">
        <PublicHeader>
          <Link to={signedIn ? '/app' : '/login'} className="btn-secondary hidden sm:inline-flex">
            {signedIn ? t('landing.open') : t('landing.signIn')}
          </Link>
        </PublicHeader>
      </div>
      <main id="main">
        <Hero mode={mode} />
        <Seasons mode={mode} panel={panel} />
        <Soil mode={mode} />
        <Water />
        <Mandi />
        <Numbers />
        <MapSection />
        <Cta />
      </main>
      <footer className="bg-ink px-4 py-8 text-center text-sm text-soil-100 sm:px-8">
        <p>{t('landing.footer')}</p>
        {mode !== 'full' && <p className="mt-2 opacity-80">{t('landing.stillNote')}</p>}
      </footer>
    </div>
  );
}
