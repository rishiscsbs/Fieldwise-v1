import { leafColours, leafFindings, leafRegions } from '@fieldwise/shared';
import type { LeafAnalyser } from './types.js';

/** The legacy colour screen: proportions of green, yellow, brown and white, plus where the off-colours are. */
export const colourHeuristic: LeafAnalyser = {
  id: 'colour-heuristic',
  version: '1',
  isModel: false,
  async analyse(img) {
    const colours = leafColours(img.data);
    const { keys, symptoms } = leafFindings(colours);
    return { colours, findings: keys, symptoms, regions: leafRegions(img.data, img.width, img.height) };
  },
};

const ANALYSERS: Record<string, LeafAnalyser> = { [colourHeuristic.id]: colourHeuristic };

export function getAnalyser(id = process.env.LEAF_ANALYSER ?? colourHeuristic.id): LeafAnalyser {
  return ANALYSERS[id] ?? colourHeuristic;
}

export type { LeafAnalyser, LeafAnalysis } from './types.js';
