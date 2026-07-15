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
    include: ['tests/**/*.test.ts', '../../tests/cloudflare/sms-summary-*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      thresholds: {
        branches: 10,
        functions: 12,
        lines: 18,
        statements: 18,
      },
    },
  },
});
