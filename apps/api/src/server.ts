import { buildApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';

const app = await buildApp();

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);

await app.listen({ port: env.PORT, host: env.HOST });
app.log.info(`API docs at http://localhost:${env.PORT}/docs`);
