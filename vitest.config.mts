import { defineConfig } from 'vitest/config';
import path from 'node:path';

const testDb = path.resolve(import.meta.dirname, 'prisma/test.db');

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    env: { DATABASE_URL: `file:${testDb}` },
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
