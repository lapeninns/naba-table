import { defineConfig } from '@playwright/test';

const reservePort = 5174;
const appPort = 5180;
const reserveBaseUrl = `http://localhost:${reservePort}`;
const appBaseUrl = `http://localhost:${appPort}`;
const harnessBaseUrl = 'http://localhost:3000';
const runDevHarnessSpecOnly = process.env.PLAYWRIGHT_DEV_HARNESS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: runDevHarnessSpecOnly ? harnessBaseUrl : reserveBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: runDevHarnessSpecOnly
    ? undefined
    : [
        {
          command: `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key NEXT_PUBLIC_SITE_URL=${reserveBaseUrl} VITE_RESERVE_ROUTER_BASE_PATH=/ VITE_DISABLE_QUERY_DEVTOOLS=1 pnpm reserve:dev -- --host 127.0.0.1 --port ${reservePort}`,
          url: reserveBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `NEXT_PUBLIC_SUPABASE_URL=http://localhost NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role NEXT_PUBLIC_SITE_URL=${appBaseUrl} NEXT_PUBLIC_APP_URL=${appBaseUrl} NEXT_DEV_PORT=${appPort} NEXT_DEV_HOST=127.0.0.1 PORT=${appPort} pnpm dev`,
          url: appBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
