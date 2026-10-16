import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const PORT = 3210;
const db = path.resolve(__dirname, 'prisma/e2e.db');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' } } },
  ],
  webServer: {
    command: `npx tsx scripts/e2e-prepare.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: `file:${db}`, INSECURE_COOKIES: 'true', NODE_ENV: 'production' },
  },
});
