// Phone + OTP login with rotating refresh tokens.
// OTPs are never stored in plain text. In development the code is printed to the server console
// (there is no SMS provider) and returned to the client so the dev login screen can show it.
import type { User } from '@prisma/client';
import { Role, type PublicUser } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { otpCode, randomToken, sameHash, sha256 } from '../lib/crypto.js';

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 30_000;
export const OTP_WINDOW_MS = 10 * 60_000;
export const OTP_MAX_PER_WINDOW = 5;
export const REFRESH_TTL_MS = 30 * 24 * 3600_000;

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const otpHash = (phone: string, code: string) => sha256(`${env.JWT_SECRET}:${phone}:${code}`);

export async function requestOtp(
  phone: string,
  now = new Date(),
): Promise<{ code: string; expiresAt: Date }> {
  const recent = await prisma.otpCode.findMany({
    where: { phone, createdAt: { gt: new Date(now.getTime() - OTP_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  const last = recent[0];
  if (last && now.getTime() - last.createdAt.getTime() < OTP_RESEND_MS) {
    throw new AuthError(429, 'otp_too_soon', 'Wait 30 seconds before asking for a new code');
  }
  if (recent.length >= OTP_MAX_PER_WINDOW) {
    throw new AuthError(429, 'otp_limit', 'Too many codes requested. Try again in 10 minutes');
  }
  const code = otpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  await prisma.otpCode.create({ data: { phone, codeHash: otpHash(phone, code), expiresAt, createdAt: now } });
  return { code, expiresAt };
}

/** Checks the code and returns the user, creating a farmer account for a new number. */
export async function verifyOtp(phone: string, code: string, now = new Date()): Promise<User> {
  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AuthError(401, 'otp_expired', 'The code has expired. Ask for a new one');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError(429, 'otp_attempts', 'Too many wrong codes. Ask for a new one');
  }
  if (!sameHash(otp.codeHash, otpHash(phone, code))) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AuthError(401, 'otp_wrong', 'That code is not right. Check and try again');
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } });
  const user = await prisma.user.upsert({ where: { phone }, update: {}, create: { phone, role: 'farmer' } });
  if (!user.active) throw new AuthError(403, 'account_disabled', 'This account has been turned off');
  return user;
}

export async function issueRefreshToken(
  userId: string,
  now = new Date(),
): Promise<{ token: string; id: string }> {
  const token = randomToken();
  const row = await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + REFRESH_TTL_MS) },
  });
  return { token, id: row.id };
}

/**
 * Exchanges a refresh token for a new one. A token that was already rotated means it leaked,
 * so every session for that user is revoked.
 */
export async function rotateRefreshToken(
  token: string,
  now = new Date(),
): Promise<{ user: User; token: string }> {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!row) throw new AuthError(401, 'refresh_invalid', 'Sign in again');
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    throw new AuthError(401, 'refresh_reused', 'Sign in again');
  }
  if (row.expiresAt <= now || !row.user.active) throw new AuthError(401, 'refresh_expired', 'Sign in again');
  const next = await issueRefreshToken(row.userId, now);
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: now, replacedById: next.id },
  });
  return { user: row.user, token: next.token };
}

export async function revokeRefreshToken(token: string, now = new Date()): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: now },
  });
}

export const publicUser = (u: User): PublicUser => ({
  id: u.id,
  phone: u.phone,
  name: u.name,
  role: Role.parse(u.role),
  districtId: u.districtId,
  lang: u.lang,
});
