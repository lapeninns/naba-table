import { defineConfig } from '@playwright/test';

/**
 * Config for the opt-in settings data-hooks browser proof. It never starts a web server: point
 * QA_DATA_HOOKS_BASE_URL at an already-running, isolated local `next dev` (the spec refuses any
 * host other than localhost, app.localhost or 127.0.0.1).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'settings-data-hooks.spec.ts',
  outputDir: process.env.QA_DATA_HOOKS_ARTIFACT_DIR ?? '../../test-results/settings-data-hooks',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  use: {
    browserName: 'chromium',
    baseURL: process.env.QA_DATA_HOOKS_BASE_URL ?? 'http://app.localhost:5182',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
