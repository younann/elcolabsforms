import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// seed credentials for e2e
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? 'local.env', quiet: true });

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8888';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'he-IL',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
    { name: 'iPad (gen 7)', use: { ...devices['iPad (gen 7)'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx dotenv-cli@8.0.0 -e local.env -- npx -y netlify-cli@27.20.0 dev --offline',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
