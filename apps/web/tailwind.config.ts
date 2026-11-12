import type { Config } from 'tailwindcss';

const v = (name: string) => `var(--${name})`;
const family = (f: string) => Object.fromEntries([900, 700, 500, 300, 100].map((s) => [s, v(`${f}-${s}`)]));

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
        paper: v('paper'),
        ink: v('ink'),
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2') },
        line: v('border'),
        fg: { DEFAULT: v('text'), muted: v('text-muted') },
        primary: { DEFAULT: v('primary'), hover: v('primary-hover'), ink: v('primary-ink') },
        accent: { DEFAULT: v('accent'), soft: v('accent-soft') },
        focus: v('focus'),
        good: { DEFAULT: v('good'), soft: v('good-soft') },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
        bad: { DEFAULT: v('bad'), soft: v('bad-soft') },
        info: { DEFAULT: v('info'), soft: v('info-soft') },
        series: { 1: v('series-1'), 2: v('series-2'), 3: v('series-3'), 4: v('series-4') },
      },
      borderRadius: { sm: v('r-sm'), md: v('r-md'), lg: v('r-lg'), xl: v('r-xl') },
      boxShadow: { 1: v('shadow-1'), 2: v('shadow-2'), 3: v('shadow-3') },
      transitionDuration: { 1: '120ms', 2: '200ms', 3: '320ms', 4: '600ms' },
      transitionTimingFunction: { out: v('ease-out'), 'in-out': v('ease-in-out') },
    },
  },
  plugins: [],
} satisfies Config;
