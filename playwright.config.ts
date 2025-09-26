import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'reserve/tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']]
});
