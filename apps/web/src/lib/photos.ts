// Picks the hero and login photo for this screen (width × pixel density), and can start fetching the login one
// before React renders, so it is ready when the page paints. Credits: public/CREDITS.md.

const need = (fraction: number) => window.innerWidth * fraction * Math.min(window.devicePixelRatio || 1, 2);

/** Landing hero: full-bleed. */
export function heroPhoto(): string {
  const px = need(1);
  return px <= 800 ? '/photos/hero-640.jpg' : px <= 1200 ? '/photos/hero-960.jpg' : '/photos/hero-1920.jpg';
}

/** Login: a banner across phones, about half the screen on wider ones. */
export function loginPhoto(): string {
  if (window.innerWidth >= 768) return '/photos/login-1440.jpg';
  // The phone banner is short (224 px) and cropped to cover, so 560 px stays sharp on phones; it is the page's
  // largest paint, so every kilobyte saved shows up as a faster first screen.
  return window.innerWidth <= 480 ? '/photos/login-560.jpg' : '/photos/login-800.jpg';
}

/**
 * Starts downloading the login photo at high priority: it is that page's largest paint. The landing hero is
 * not preloaded: there the wordmark is the largest paint, and the photo should not compete with it.
 */
export function preloadPagePhoto(path: string) {
  const src = path === '/login' ? loginPhoto() : null;
  if (!src) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.setAttribute('fetchpriority', 'high');
  document.head.appendChild(link);
}
