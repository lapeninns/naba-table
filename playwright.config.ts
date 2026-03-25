import { defineConfig } from '@playwright/test';
import path from 'node:path';

const reservePort = 5174;
const appPort = 5180;
const reserveBaseUrl = `http://localhost:${reservePort}`;
const appBaseUrl = `http://localhost:${appPort}`;
const harnessBaseUrl = 'http://localhost:3000';
const runDevHarnessSpecOnly = process.env.PLAYWRIGHT_DEV_HARNESS === '1';
const invokedTestPaths = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith('-'))
  .map((arg) => path.normalize(arg));
const shouldReuseHarnessServerByDefault =
  runDevHarnessSpecOnly ||
  invokedTestPaths.some((arg) => arg.endsWith(path.normalize('tests/e2e/ops-email-delivery-dev-harness.spec.ts')));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: shouldReuseHarnessServerByDefault ? harnessBaseUrl : reserveBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: shouldReuseHarnessServerByDefault
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
