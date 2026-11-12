import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthSession, OtpRequest, OtpVerify, PublicUser } from '@fieldwise/shared';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { isDev, isProd } from '../env.js';
import { ACCESS_TTL } from '../plugins/auth.js';
import {
  AuthError,
  REFRESH_TTL_MS,
  issueRefreshToken,
  publicUser,
  requestOtp,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyOtp,
} from '../services/auth.js';

export const REFRESH_COOKIE = 'fw_rt';
const Err = z.object({ error: z.string(), message: z.string() });
const tag = { tags: ['auth'] };

const authRoutes: FastifyPluginAsyncZod<{ authRateLimit: number }> = async (app, opts) => {
  const strict = { config: { rateLimit: { max: opts.authRateLimit, timeWindow: '1 minute' } } };

  const setRefresh = (reply: FastifyReply, token: string) =>
    reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_TTL_MS / 1000,
    });
  const clearRefresh = (reply: FastifyReply) => reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });

  const session = (u: User) => ({
    accessToken: app.jwt.sign(
      { sub: u.id, role: publicUser(u).role, districtId: u.districtId },
      { expiresIn: ACCESS_TTL },
    ),
    user: publicUser(u),
  });

  const fail = (reply: FastifyReply, e: unknown) => {
    if (e instanceof AuthError)
      return reply.code(e.status as 401).send({ error: e.code, message: e.message });
    throw e;
  };

  app.post(
    '/otp/request',
    {
      ...strict,
      schema: {
        ...tag,
        summary: 'Send a one-time code to a phone number',
        description:
          'No SMS provider is connected. In development the code is printed to the server console and returned as devCode.',
        body: OtpRequest,
        response: {
          200: z.object({ sent: z.literal(true), expiresAt: z.string(), devCode: z.string().optional() }),
          429: Err,
        },
      },
    },
    async (req, reply) => {
      try {
        const { code, expiresAt } = await requestOtp(req.body.phone);
        if (isDev) {
          req.log.info({ phone: req.body.phone }, `OTP for ${req.body.phone}: ${code}`);
          console.log(
            `\n  ┌──────────────────────────────┐\n  │  OTP ${req.body.phone}: ${code}  │\n  └──────────────────────────────┘\n`,
          );
        }
        return {
          sent: true as const,
          expiresAt: expiresAt.toISOString(),
          ...(isDev ? { devCode: code } : {}),
        };
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.post(
    '/otp/verify',
    {
      ...strict,
      schema: {
        ...tag,
        summary: 'Exchange a one-time code for a session',
        description:
          'Returns an access token and sets an httpOnly refresh-token cookie. A new number gets a farmer account.',
        body: OtpVerify,
        response: { 200: AuthSession, 401: Err, 403: Err, 429: Err },
      },
    },
    async (req, reply) => {
      try {
        const user = await verifyOtp(req.body.phone, req.body.code);
        const rt = await issueRefreshToken(user.id);
        setRefresh(reply, rt.token);
        return session(user);
      } catch (e) {
        return fail(reply, e);
      }
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        ...tag,
        summary: 'Rotate the refresh-token cookie and get a new access token',
        response: { 200: AuthSession, 401: Err },
      },
    },
    async (req, reply) => {
      const token = req.cookies[REFRESH_COOKIE];
      if (!token) return reply.code(401).send({ error: 'refresh_missing', message: 'Sign in again' });
      try {
        const r = await rotateRefreshToken(token);
        setRefresh(reply, r.token);
        return session(r.user);
      } catch (e) {
        clearRefresh(reply);
        return fail(reply, e);
      }
    },
  );

  app.post(
    '/logout',
    { schema: { ...tag, summary: 'End this session', response: { 204: z.null() } } },
    async (req, reply) => {
      const token = req.cookies[REFRESH_COOKIE];
      if (token) await revokeRefreshToken(token);
      clearRefresh(reply);
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        ...tag,
        summary: 'The signed-in user',
        security: [{ bearer: [] }],
        response: { 200: PublicUser, 401: Err },
      },
    },
    async (req, reply) => {
      const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (!user || !user.active)
        return reply.code(401).send({ error: 'unauthorized', message: 'Sign in again' });
      return publicUser(user);
    },
  );
};

export default authRoutes;
