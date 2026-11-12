// Fresh SQLite test database with the full seed, once per test run.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default async function setup() {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'file:./test.db' };
  execSync('npx prisma db push --force-reset --skip-generate', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
