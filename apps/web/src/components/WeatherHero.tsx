// The overview header: a greeting for the time of day, the farm in one line, and today's weather, over a
// season-washed sky that rains, shimmers or glows to match the forecast (WeatherFx). Text sits on the light
// season wash in light mode and the deep one in dark mode, so it keeps full contrast.
import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { useFmt } from '../lib/format';
import { condition, type Condition } from '../lib/weather';
import type { ForecastDayDto } from '../lib/api-types';
import { WeatherFx } from './WeatherFx';

/** A small drawn sky icon for today's condition. */
function SkyIcon({ cond }: { cond: Condition }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      {(cond === 'clear' || cond === 'cloudy') && (
        <g>
          <circle
            cx={cond === 'clear' ? 28 : 20}
            cy={cond === 'clear' ? 28 : 20}
            r="11"
            fill="var(--accent)"
          />
          {cond === 'clear' &&
            Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <path
                  key={i}
                  d={`M${28 + Math.cos(a) * 16} ${28 + Math.sin(a) * 16}L${28 + Math.cos(a) * 21} ${28 + Math.sin(a) * 21}`}
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
        </g>
      )}
      {cond !== 'clear' && (
        <path
          d="M16 40h24a9 9 0 0 0 0-18 12 12 0 0 0-23-2 8 8 0 0 0-1 20Z"
          fill="var(--surface)"
          stroke="var(--text-muted)"
          strokeWidth="2"
        />
      )}
      {(cond === 'showers' || cond === 'heavy') &&
        [18, 28, 38]
          .slice(0, cond === 'heavy' ? 3 : 2)
          .map((x) => (
            <path
              key={x}
              d={`M${x} 45l-3 7`}
              stroke="var(--season-b)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
    </svg>
  );
}

export function WeatherHero({
  title,
  sub,
  today,
  children,
}: {
  title: string;
  sub: ReactNode;
  today?: ForecastDayDto;
  children?: ReactNode;
}) {
  const { t, date } = useFmt();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'overview.morning' : hour < 17 ? 'overview.afternoon' : 'overview.evening');
  const cond = today ? condition(today) : 'clear';
  const hot = !!today && today.tmax >= 36;
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-season-c shadow-glass">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-season-c via-surface/40 to-surface"
      />
      <WeatherFx cond={cond} hot={hot} morning={hour < 11} />
      <div className="relative flex flex-wrap items-end justify-between gap-6 p-5 sm:p-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg-muted">
            {greeting} · {date(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <m.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 font-display text-4xl leading-tight sm:text-5xl"
          >
            {title}
          </m.h1>
          <p className="mt-1 max-w-xl text-fg-muted">{sub}</p>
        </div>
        {today && (
          <div className="flex items-center gap-3">
            <SkyIcon cond={cond} />
            <div>
              <div className="num-hero">{Math.round(today.tmax)}°</div>
              <div className="font-semibold">
                {t(`weather.cond.${cond}`)}
                {hot && ` · ${t('overview.hot')}`}
              </div>
              <div className="text-sm text-fg-muted">
                {t('overview.range', { lo: Math.round(today.tmin), hi: Math.round(today.tmax) })} ·{' '}
                {t('overview.rainChance', { p: today.rp })}
              </div>
            </div>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
