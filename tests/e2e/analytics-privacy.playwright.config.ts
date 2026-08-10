import { defineConfig } from '@playwright/test';

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost';

export default defineConfig({
  testDir: '.',
  testMatch: 'posthog-cookie-privacy.spec.ts',
  outputDir: '../../.omo/evidence/gbp-wave2c-cookie-browser',
  preserveOutput: 'always',
  workers: 1,
  use: {
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
