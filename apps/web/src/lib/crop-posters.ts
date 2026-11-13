// Gallery images for crops: the royalty-free photo when there is one, otherwise a poster drawn in code (the
// crop's emoji over furrows in its season's colours). Posters are SVG data URLs, so the WebGL carousel can use
// them as textures and they work offline. Colours are literal because an image cannot read CSS variables.
import { CROP_PHOTOS } from './crop-photos';

const SEASON_HUES: Record<string, [string, string]> = {
  kharif: ['#1d6a44', '#6c9ec0'],
  rabi: ['#c9930f', '#8db3cf'],
  zaid: ['#b0533a', '#d9a04a'],
};

function poster(emoji: string, season: string): string {
  const [a, b] = SEASON_HUES[season] ?? SEASON_HUES.kharif!;
  const furrows = Array.from(
    { length: 7 },
    (_, i) =>
      `<path d="M-40 ${300 + i * 34} Q360 ${250 + i * 30} 760 ${300 + i * 34}" stroke="#fff" stroke-opacity="${0.08 + i * 0.02}" stroke-width="10" fill="none"/>`,
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="720" height="480" fill="url(#g)"/>${furrows}<circle cx="560" cy="110" r="60" fill="#fff" fill-opacity=".18"/><text x="360" y="270" font-size="200" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function cropImage(crop: { id: string; e: string; s: string[] }): string {
  return CROP_PHOTOS[crop.id] ?? poster(crop.e, crop.s[0] ?? 'kharif');
}
