import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  hasZodFastifySchemaValidationErrors,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env, isDev } from './env.js';
import auth from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import systemRoutes from './routes/system.js';

export interface BuildOptions extends FastifyServerOptions {
  /** Requests per minute per IP on the OTP routes (default 10). */
  authRateLimit?: number;
}

export async function buildApp({ authRateLimit = 10, ...opts }: BuildOptions = {}) {
  const app = Fastify({
    logger: isDev
      ? { transport: { target: 'pino-pretty', options: { ignore: 'pid,hostname' } } }
      : env.NODE_ENV !== 'test',
    ...opts,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const first = err.validation[0];
      return reply.code(400).send({
        error: 'invalid_input',
        message: first?.message ?? 'Check the form and try again',
        issues: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    if (err.statusCode === 429) {
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests. Slow down' });
    }
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) {
      req.log.error(err);
      return reply.code(500).send({ error: 'server_error', message: 'Something went wrong' });
    }
    return reply.code(status).send({ error: 'request_error', message: err.message });
  });

  // The API serves JSON plus Swagger UI, which needs inline scripts, so CSP is left to the web app.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Fieldwise API',
        version: '2.0.0',
        description: 'Crop advisory platform. Agronomic figures are indicative.',
      },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(auth);
  await app.register(systemRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api/auth', authRateLimit });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
