import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup-tests.ts'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@reserve': path.resolve(__dirname),
      '@app': path.resolve(__dirname, 'app'),
      '@features': path.resolve(__dirname, 'features'),
      '@entities': path.resolve(__dirname, 'entities'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@pages': path.resolve(__dirname, 'pages'),
      '@tests': path.resolve(__dirname, 'tests'),
    },
  },
});
