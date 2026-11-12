// Shared, mutable story state. GSAP ScrollTrigger writes it on scroll; the 3D scene reads it every frame.
// It is deliberately not React state, so scrolling never re-renders the page.
/** lab = the data-centre scene used by the pitch deck */
export type SceneName = 'farm' | 'soil' | 'lab';

export const story = {
  /** Camera flight over the farm: 0 = hero, 1 = end of the seasons section */
  fly: 0,
  /** Season blend: 0 = kharif, 1 = rabi, 2 = zaid */
  season: 0,
  /** Soil layers opening: 0 closed, 1 fully peeled */
  peel: 0,
  scene: 'farm' as SceneName,
  /** Pointer in -1..1, for the sun and a little parallax */
  pointer: { x: 0, y: 0 },
};

export const SEASON_IDS = ['kharif', 'rabi', 'zaid'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** Freeze the story in a given state (used to render the Lite-mode stills). */
export function setStill(still: SeasonId | 'soil') {
  story.pointer.x = 0.35;
  story.pointer.y = 0.2;
  if (still === 'soil') {
    story.scene = 'soil';
    story.peel = 0.75;
    return;
  }
  story.scene = 'farm';
  story.season = SEASON_IDS.indexOf(still);
  story.fly = [0.12, 0.5, 0.85][story.season]!;
}
