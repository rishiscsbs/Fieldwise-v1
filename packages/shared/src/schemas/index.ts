import { z } from 'zod';

export const ROLES = ['farmer', 'officer', 'admin'] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

export const SeasonEnum = z.enum(['kharif', 'rabi', 'zaid']);

/** Indian mobile number, normalised to +91XXXXXXXXXX. Accepts spaces, dashes and an optional +91 / 0 prefix. */
export const Phone = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, '').replace(/^(\+91|0091|0)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number'))
  .transform((s) => `+91${s}`);

export const OtpRequest = z.object({ phone: Phone });
export const OtpVerify = z.object({
  phone: Phone,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const PublicUser = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string(),
  role: Role,
  districtId: z.string().nullable(),
  lang: z.string(),
});
export type PublicUser = z.infer<typeof PublicUser>;

export const AuthSession = z.object({ accessToken: z.string(), user: PublicUser });
export type AuthSession = z.infer<typeof AuthSession>;

/** Soil Health Card values. Ranges are generous bounds to catch typos, not agronomic limits. */
export const SoilTestInput = z.object({
  testedAt: z.coerce.date(),
  ph: z.number().min(3).max(11),
  n: z.number().min(0).max(2000),
  p: z.number().min(0).max(500),
  k: z.number().min(0).max(2000),
});

export const FarmInput = z.object({
  name: z.string().trim().min(1).max(80),
  districtId: z.string(),
  village: z.string().trim().max(80).default(''),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lon: z.number().min(-180).max(180).nullable().optional(),
  soil: z.string(),
  irrigation: z.enum(['none', 'partial', 'full']),
  areaAcres: z.number().positive().max(10000),
  season: SeasonEnum,
  crop: z.string().nullable().optional(),
});
export type FarmInput = z.infer<typeof FarmInput>;
