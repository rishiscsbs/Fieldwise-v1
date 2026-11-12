import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test', DATABASE_URL: 'file:./test.db', UPLOAD_DIR: 'uploads-test' },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
