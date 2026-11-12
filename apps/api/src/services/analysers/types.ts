import type { LeafColours, LeafRegion } from '@fieldwise/shared';
import type { Rgba } from '../uploads.js';

export interface LeafAnalysis {
  colours: LeafColours;
  /** Advice keys in the `advice` namespace, e.g. ph_y */
  findings: string[];
  /** Symptom ids to suggest to the farmer */
  symptoms: string[];
  regions: LeafRegion[];
}

/**
 * Something that looks at a leaf photo. To plug in a trained model (e.g. a PlantVillage classifier
 * exported to ONNX or TensorFlow.js), implement this with `isModel: true`, map its classes to symptom ids,
 * and register it in index.ts. Do not report accuracy figures the model has not been validated for.
 */
export interface LeafAnalyser {
  id: string;
  version: string;
  /** true only for a trained model; the UI words results more cautiously when false */
  isModel: boolean;
  analyse(img: Rgba, crop: string): Promise<LeafAnalysis>;
}
