// Creates apps/api/.env from .env.example on a fresh clone, so `npm run dev` needs no manual steps.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = join(dir, '.env');
if (!existsSync(env)) {
  copyFileSync(join(dir, '.env.example'), env);
  console.log('Created apps/api/.env from .env.example');
}
