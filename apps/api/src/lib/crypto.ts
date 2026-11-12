import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (s: string | Buffer): string => createHash('sha256').update(s).digest('hex');

/** Opaque random token, URL-safe. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Six-digit one-time code. */
export const otpCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Constant-time comparison of two hex digests. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
