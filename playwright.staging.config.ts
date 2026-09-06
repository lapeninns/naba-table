import { defineConfig } from '@playwright/test';

import { resolveStagingEnv } from './tests/e2e/staging/env';

/**
 * Staging proof pack. Runs only against the dedicated staging deployment:
 * - no webServer, no mocks, no QA fixture routes;
 * - baseURL from STAGING_PUBLIC_URL (ops proofs use STAGING_OPS_URL explicitly);
 * - retries 0 and workers 1 so every proof is deterministic and attributable;
 * - the config throws at import time when STAGING_PUBLIC_URL/STAGING_OPS_URL name a
 *   production host or any required MONITORING_TOKEN / STAGING_SYNTHETIC_* input is missing.
 */
const staging = resolveStagingEnv();

export default defineConfig({
  testDir: './tests/e2e/staging',
  testMatch: /.*\.spec\.ts$/u,
  outputDir: 'test-results/staging/artifacts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/staging/junit.xml' }],
    ['json', { outputFile: 'test-results/staging/results.json' }],
  ],
  use: {
    baseURL: staging.publicUrl,
    // API/browser traces capture monitoring, recovery, provider and protection credentials.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'staging-chromium', use: { browserName: 'chromium' } }],
});
