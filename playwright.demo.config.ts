import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.DEMO_BASE_URL || 'http://127.0.0.1:3211';
export default defineConfig({
  testDir: 'tests/demo', timeout: 120_000, expect: { timeout: 20_000 }, workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'demo', use: { ...devices['Desktop Chrome'], ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}) } }],
  webServer: process.env.DEMO_BASE_URL ? undefined : { command: 'node scripts/serve-demo.mjs', url: baseURL, timeout: 30_000 },
});
