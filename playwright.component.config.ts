import { defineConfig } from '@playwright/experimental-ct-react';

export default defineConfig({
  testDir: 'tests/component',
  snapshotDir: 'tests/visual/baselines',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-component-report' }]],
  use: {
    ctPort: 3100,
    screenshot: 'only-on-failure',
  },
});
