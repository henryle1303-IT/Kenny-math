import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Existing E2E tests exercise clear-progress and bank edits. Supply a disposable
// Neon preview database explicitly; never infer it from production DATABASE_URL.
const databaseUrl = process.env.POSTGRES_TEST_DATABASE_URL;
if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
  throw new Error('Set POSTGRES_TEST_DATABASE_URL to a disposable Neon preview database, then migrate, seed and build with the PostgreSQL client first.');
}
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  ...base,
  webServer: {
    command: 'node node_modules/next/dist/bin/next start -p 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: databaseUrl, INSECURE_COOKIES: 'true', NODE_ENV: 'production' },
  },
});
