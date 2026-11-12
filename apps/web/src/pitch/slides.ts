// The pitch deck: slide order, and where the camera goes for each one in the shared 3D world.
// Text lives in i18n under app:pitch.slides.<id>.
import type { SceneName } from '../landing/story';

export type Vec3 = [number, number, number];

export interface Slide {
  id: 'problem' | 'solution' | 'demo' | 'impact' | 'architecture' | 'roadmap' | 'team';
  scene: SceneName;
  /** 0 kharif, 1 rabi, 2 zaid */
  season: number;
  camera: { pos: Vec3; look: Vec3 };
  /** Which still to show when 3D is off */
  still: 'kharif' | 'rabi' | 'zaid' | 'soil';
  /** Slide shows live platform numbers */
  live?: boolean;
}

export const SLIDES: Slide[] = [
  // Dry season, wide and high: the problem.
  { id: 'problem', scene: 'farm', season: 2, camera: { pos: [-22, 14, 26], look: [0, 0, 0] }, still: 'zaid' },
  // Monsoon green, closer: the plan.
  {
    id: 'solution',
    scene: 'farm',
    season: 0,
    camera: { pos: [-12, 6, 13], look: [-2, 0, 0] },
    still: 'kharif',
  },
  // Down by the farmhouse, looking at it from the field side (no trees in the way).
  {
    id: 'demo',
    scene: 'farm',
    season: 0.6,
    camera: { pos: [-11, 4.5, 3], look: [-18.5, 1.2, -3] },
    still: 'kharif',
    live: true,
  },
  // Mustard in bloom.
  {
    id: 'impact',
    scene: 'farm',
    season: 1,
    camera: { pos: [6, 7, -16], look: [1, 0, -1] },
    still: 'rabi',
    live: true,
  },
  // Fly into the data centre.
  {
    id: 'architecture',
    scene: 'lab',
    season: 1,
    camera: { pos: [9, -196, 14], look: [0, -199, 0] },
    still: 'soil',
  },
  // Back over the farm, high, the whole picture.
  {
    id: 'roadmap',
    scene: 'farm',
    season: 1.4,
    camera: { pos: [16, 18, 18], look: [0, 0, 0] },
    still: 'rabi',
  },
  { id: 'team', scene: 'farm', season: 0, camera: { pos: [0, 9, 26], look: [0, 0, 0] }, still: 'kharif' },
];

export const clampSlide = (i: number) => Math.max(0, Math.min(SLIDES.length - 1, i));
