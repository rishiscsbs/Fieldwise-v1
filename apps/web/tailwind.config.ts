import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;

/**
 * A colour token that also works with Tailwind's opacity modifier (`bg-surface/85`). Tailwind 3 cannot add
 * alpha to a plain `var(--x)`, so when an opacity is asked for we mix the token with transparent instead.
 */
// Tailwind 3 still accepts colour functions but its Config type no longer lists them, hence the cast.
const c = (name: string) =>
  (({ opacityValue }: { opacityValue?: string }) =>
    // Plain classes pass var(--tw-*-opacity); only an explicit /NN modifier gives a number. Using color-mix
    // just for those keeps ordinary backgrounds working on older WebViews without color-mix support.
    opacityValue === undefined || !/^[\d.]+$/.test(opacityValue) || opacityValue === '1'
      ? `var(--${name})`
      : `color-mix(in srgb, var(--${name}) calc(${opacityValue} * 100%), transparent)`) as unknown as string;

const family = (f: string) => Object.fromEntries([900, 700, 500, 300, 100].map((s) => [s, c(`${f}-${s}`)]));

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    fontFamily: {
      display: v('font-display').split(','),
      sans: v('font-text').split(','),
    },
    fontSize: {
      xs: ['12px', '18px'],
      sm: ['14px', '21px'],
      base: ['16px', '26px'],
      lg: ['18px', '28px'],
      xl: ['20px', '30px'],
      '2xl': ['24px', '32px'],
      '3xl': ['30px', '38px'],
      '4xl': ['38px', '46px'],
      '5xl': ['48px', '56px'],
      '6xl': ['64px', '70px'],
    },
    extend: {
      colors: {
        soil: family('soil'),
        monsoon: family('monsoon'),
        mustard: family('mustard'),
        leaf: family('leaf'),
        paper: c('paper'),
        ink: c('ink'),
        bg: c('bg'),
        surface: { DEFAULT: c('surface'), 2: c('surface-2') },
        line: c('border'),
        fg: { DEFAULT: c('text'), muted: c('text-muted') },
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), ink: c('primary-ink') },
        accent: { DEFAULT: c('accent'), soft: c('accent-soft') },
        focus: c('focus'),
        good: { DEFAULT: c('good'), soft: c('good-soft') },
        warn: { DEFAULT: c('warn'), soft: c('warn-soft') },
        bad: { DEFAULT: c('bad'), soft: c('bad-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        series: { 1: c('series-1'), 2: c('series-2'), 3: c('series-3'), 4: c('series-4') },
        season: { a: c('season-a'), b: c('season-b'), c: c('season-c') },
        band: { DEFAULT: c('band'), ink: c('band-ink') },
        // Glass tokens already carry their alpha, so they are plain var()s (no opacity modifier).
        glass: { DEFAULT: v('glass'), strong: v('glass-strong'), line: v('glass-border') },
      },
      borderRadius: { sm: v('r-sm'), md: v('r-md'), lg: v('r-lg'), xl: v('r-xl'), '2xl': v('r-2xl') },
      boxShadow: { 1: v('shadow-1'), 2: v('shadow-2'), 3: v('shadow-3'), glass: v('shadow-glass') },
      backdropBlur: { glass: v('glass-blur') },
      transitionDuration: { 1: '120ms', 2: '200ms', 3: '320ms', 4: '600ms', 5: '900ms' },
      transitionTimingFunction: { out: v('ease-out'), 'in-out': v('ease-in-out'), spring: v('ease-spring') },
    },
  },
  plugins: [],
} satisfies Config;
