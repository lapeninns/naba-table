import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(process.cwd()) } },
  test: {
    environment: 'node',
    include: ['.omo/evidence/gbp-wave1c-provider.oidc.test.ts'],
  },
});
