import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  AGMARKNET_API_KEY: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});

export const env = Env.parse(process.env);
// Prisma reads DATABASE_URL from process.env, so make the default visible to it.
process.env.DATABASE_URL = env.DATABASE_URL;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';

if (isProd && env.JWT_SECRET.startsWith('dev-only')) {
  throw new Error('Set a real JWT_SECRET in production');
}
