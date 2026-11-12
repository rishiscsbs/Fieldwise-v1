import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../db.js';
import { isDev } from '../env.js';
import { DEMO_ACCOUNTS } from '../demo.js';

const systemRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness and database check',
        response: { 200: z.object({ ok: z.boolean(), db: z.boolean(), time: z.string() }) },
      },
    },
    async () => {
      const db = await prisma.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      );
      return { ok: true, db, time: new Date().toISOString() };
    },
  );

  app.get(
    '/dev/demo-accounts',
    {
      schema: {
        tags: ['system'],
        summary: 'Demo logins, shown on the login screen in development only',
        response: {
          200: z.object({
            enabled: z.boolean(),
            accounts: z.array(z.object({ role: z.string(), name: z.string(), phone: z.string() })),
          }),
        },
      },
    },
    async () => ({
      enabled: isDev,
      accounts: isDev ? DEMO_ACCOUNTS.map(({ role, name, phone }) => ({ role, name, phone })) : [],
    }),
  );
};

export default systemRoutes;
