// JSON-in-string columns keep the schema portable between SQLite and Postgres.
// Every read goes through zod so a bad row fails loudly instead of leaking into the engine.
import { z } from 'zod';
import type { Labels } from '@fieldwise/shared';

export const LabelsSchema = z.object({ en: z.string() }).catchall(z.string()) as z.ZodType<Labels>;
export const StringList = z.array(z.string());

export const parseLabels = (s: string): Labels => LabelsSchema.parse(JSON.parse(s));
export const parseList = (s: string): string[] => StringList.parse(JSON.parse(s));
export const toJson = (v: unknown): string => JSON.stringify(v);
