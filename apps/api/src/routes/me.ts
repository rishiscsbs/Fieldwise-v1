import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AuthSession, LANGUAGES } from '@fieldwise/shared';
import { prisma } from '../db.js';
import { badRequest } from '../lib/http.js';
import { bearer, errors } from '../lib/route.js';
import { ACCESS_TTL } from '../plugins/auth.js';
import { publicUser } from '../services/auth.js';

const MeInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  lang: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]).optional(),
  districtId: z.string().optional(),
});

const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Update your name, language or district',
        description:
          'Returns a fresh access token because the district is part of it. Only farmers change their own district.',
        security: bearer,
        body: MeInput,
        response: { 200: AuthSession, ...errors },
      },
    },
    async (req) => {
      const { districtId, ...rest } = req.body;
      if (districtId !== undefined) {
        if (req.user.role !== 'farmer')
          throw badRequest('district_locked', 'Ask an admin to change your district');
        if (!(await prisma.district.findUnique({ where: { id: districtId } }))) {
          throw badRequest('unknown_district', 'Pick a district from the list');
        }
      }
      const u = await prisma.user.update({
        where: { id: req.user.sub },
        data: { ...rest, ...(districtId ? { districtId } : {}) },
      });
      const pu = publicUser(u);
      return {
        accessToken: app.jwt.sign(
          { sub: u.id, role: pu.role, districtId: u.districtId },
          { expiresIn: ACCESS_TTL },
        ),
        user: pu,
      };
    },
  );
};

export default meRoutes;
