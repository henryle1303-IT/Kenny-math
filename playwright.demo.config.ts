import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/demo', timeout: 120_000, expect: { timeout: 20_000 }, workers: 1,
  use: { baseURL: 'http://127.0.0.1:3211', trace: 'retain-on-failure' },
  projects: [{ name: 'demo', use: { ...devices['Desktop Chrome'], ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}) } }],
  webServer: { command: 'node scripts/serve-demo.mjs', url: 'http://127.0.0.1:3211', timeout: 30_000 },
});
