// Checks WCAG contrast for every season × theme straight from apps/web/src/styles/tokens.css.
// Glass is composited over what sits behind it: the page (plus the field texture) in the app, and both
// pure black and pure white for glass over photos (where the rule is to use --glass-strong).
//
// Usage: node scripts/check-contrast.mjs [--all]   (--all prints passing pairs too)
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../apps/web/src/styles/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

// Top-level rule blocks only (media queries are motion tweaks, not colours).
const blocks = new Map();
for (const m of css.matchAll(/(^|\n)([^{}@\n][^{}]*?)\{([^{}]*)\}/g)) {
  const sel = m[2].trim().replace(/"/g, "'");
  const vars = blocks.get(sel) ?? {};
  for (const d of m[3].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[d[1]] = d[2].trim().replace(/\s+/g, ' ');
  blocks.set(sel, vars);
}

const SEASONS = ['kharif', 'rabi', 'zaid'];
const THEMES = ['light', 'dark'];

function tokensFor(theme, season) {
  const layers = [':root'];
  if (theme === 'dark') layers.push(":root[data-theme='dark']");
  layers.push(`:root[data-season='${season}']`);
  if (theme === 'dark') layers.push(`:root[data-theme='dark'][data-season='${season}']`);
  const out = {};
  for (const l of layers) {
    if (!blocks.has(l)) throw new Error(`tokens.css has no block for ${l}`);
    Object.assign(out, blocks.get(l));
  }
  return out;
}

function resolve(tokens, value, depth = 0) {
  if (depth > 10) throw new Error(`var() loop at ${value}`);
  const m = /^var\(--([\w-]+)\)$/.exec(value);
  return m ? resolve(tokens, tokens[m[1]], depth + 1) : value;
}

/** Parses #rgb, #rrggbb and rgb(r g b / a) into [r, g, b, a] with channels 0–255 and a 0–1. */
function parse(c) {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  throw new Error(`Cannot parse colour ${c}`);
}

const over = (top, under) => {
  const a = top[3];
  return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
};

const lum = ([r, g, b]) => {
  const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const BLACK = [0, 0, 0, 1];
const WHITE = [255, 255, 255, 1];

let failures = 0;
const showAll = process.argv.includes('--all');

for (const theme of THEMES) {
  for (const season of SEASONS) {
    const t = tokensFor(theme, season);
    const col = (name) => {
      const v = resolve(t, t[name]);
      if (!v) throw new Error(`--${name} is not defined for ${season}/${theme}`);
      return parse(v);
    };
    const bg = col('bg');
    const textured = over(col('texture-ink'), bg);
    const surfaces = {
      bg,
      surface: col('surface'),
      'surface-2': col('surface-2'),
      // The overview weather header sits on the season wash.
      'season-c': col('season-c'),
      'glass/bg': over(col('glass'), bg),
      'glass/texture': over(col('glass'), textured),
      'glass-strong/black': over(col('glass-strong'), BLACK),
      'glass-strong/white': over(col('glass-strong'), WHITE),
    };
    const checks = [];
    for (const [name, s] of Object.entries(surfaces)) {
      checks.push(['text', name, col('text'), s, 4.5]);
      checks.push(['text-muted', name, col('text-muted'), s, 4.5]);
    }
    for (const name of ['bg', 'surface', 'surface-2', 'glass/bg', 'glass/texture']) {
      checks.push(['primary', name, col('primary'), surfaces[name], 4.5]);
    }
    checks.push(['primary-ink', 'primary', col('primary-ink'), col('primary'), 4.5]);
    checks.push(['primary-ink', 'primary-hover', col('primary-ink'), col('primary-hover'), 4.5]);
    checks.push(['text', 'accent-soft', col('text'), col('accent-soft'), 4.5]);
    checks.push(['ink', 'accent', parse(resolve(t, t.ink)), col('accent'), 4.5]);
    checks.push(['band-ink', 'band', col('band-ink'), col('band'), 4.5]);
    checks.push(['accent fill', 'band', col('accent'), col('band'), 3]);
    for (const s of ['good', 'warn', 'bad', 'info']) {
      checks.push([s, 'surface', col(s), surfaces.surface, 4.5]);
      checks.push([s, 'bg', col(s), bg, 4.5]);
      checks.push([s, `${s}-soft`, col(s), col(`${s}-soft`), 4.5]);
    }
    // Non-text: the focus ring and the primary fill against the page (WCAG 1.4.11).
    checks.push(['focus', 'bg', col('focus'), bg, 3]);
    checks.push(['focus', 'surface', col('focus'), surfaces.surface, 3]);

    const bad = [];
    for (const [fg, on, a, b, min] of checks) {
      const r = ratio(a, b);
      if (r < min) bad.push(`  FAIL ${fg} on ${on}: ${r.toFixed(2)} (needs ${min})`);
      else if (showAll) bad.push(`  ok   ${fg} on ${on}: ${r.toFixed(2)}`);
    }
    failures += bad.filter((l) => l.includes('FAIL')).length;
    console.log(`${season}/${theme}: ${checks.length} pairs${bad.length ? '\n' + bad.join('\n') : ' pass'}`);
  }
}

if (failures) {
  console.error(`\n${failures} contrast failure(s).`);
  process.exit(1);
}
console.log('\nAll seasonal themes meet WCAG AA.');
