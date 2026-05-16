import { defineConfig } from '@playwright/test';

import { getQaBrowserArtifactDir } from './scripts/qa/artifacts';
import { assertQaEnvironment } from './scripts/qa/environment';

assertQaEnvironment();

function readPort(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const reservePort = readPort('QA_RESERVE_PORT', 5174);
const appPort = readPort('QA_APP_PORT', 5180);
const reserveBaseUrl = `http://localhost:${reservePort}`;
const appBaseUrl = `http://localhost:${appPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: getQaBrowserArtifactDir(),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: reserveBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key NEXT_PUBLIC_SITE_URL=${reserveBaseUrl} VITE_RESERVE_ROUTER_BASE_PATH=/ VITE_DISABLE_QUERY_DEVTOOLS=1 pnpm reserve:dev -- --host 127.0.0.1 --port ${reservePort}`,
      url: reserveBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `QA_APP_PORT=${appPort} tsx scripts/qa/clear-next-dev-lock.ts && QA_ENABLE_AUTH_FIXTURES=1 QA_TARGET_ENV=local QA_USE_MOCKS=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role NEXT_PUBLIC_SITE_URL=${appBaseUrl} NEXT_PUBLIC_APP_URL=${appBaseUrl} NEXT_DEV_PORT=${appPort} NEXT_DEV_HOST=127.0.0.1 PORT=${appPort} pnpm dev`,
      url: appBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
