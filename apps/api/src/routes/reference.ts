import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ReferenceDto } from '@fieldwise/shared';
import { referenceDto } from '../services/reference.js';

const referenceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/reference',
    {
      schema: {
        tags: ['reference'],
        summary:
          'Districts, soils, seasons, crops, pests, symptoms and fertilisers with English and Hindi labels',
        description: 'Public. Agronomic figures are indicative reference values.',
        response: { 200: ReferenceDto },
      },
    },
    async (_req, reply) => {
      reply.header('cache-control', 'public, max-age=300');
      return referenceDto();
    },
  );
};

export default referenceRoutes;
