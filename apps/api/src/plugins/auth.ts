import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@fieldwise/shared';
import { env } from '../env.js';

export interface AccessClaims {
  sub: string;
  role: Role;
  districtId: string | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessClaims;
    user: AccessClaims;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: rejects requests without a valid access token */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler: requires a valid access token with one of the given roles */
    requireRole: (...roles: Role[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const ACCESS_TTL = '15m';

export default fp(async (app) => {
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized', message: 'Sign in again' });
    }
  });

  app.decorate('requireRole', (...roles: Role[]) => async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized', message: 'Sign in again' });
    }
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: 'forbidden', message: 'You do not have access to this' });
    }
  });
});
