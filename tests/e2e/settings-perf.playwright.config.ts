import { defineConfig } from '@playwright/test';

/**
 * Config for the opt-in settings performance spec. It never starts a web server: point
 * QA_PERF_BASE_URL at an already-running, isolated local `next dev` (the spec refuses any host
 * other than localhost, app.localhost or 127.0.0.1).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'settings-perf.spec.ts',
  outputDir: process.env.QA_PERF_ARTIFACT_DIR ?? '../../test-results/settings-perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45 * 60_000,
  expect: { timeout: 15_000 },
  use: {
    browserName: 'chromium',
    baseURL: process.env.QA_PERF_BASE_URL ?? 'http://app.localhost:5182',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
