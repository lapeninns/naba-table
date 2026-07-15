import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appDir, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@': repositoryRoot,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', '../../tests/cloudflare/email-queue-gateway.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{mjs,ts}'],
      thresholds: {
        branches: 10,
        functions: 15,
        lines: 14,
        statements: 14,
      },
    },
  },
});
