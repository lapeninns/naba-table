import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@/app': path.resolve(rootDir, 'src/app'),
      '@/guest': path.resolve(rootDir, 'src/guest'),
      '@/components/ui': path.resolve(rootDir, 'components/ui'),
      '@/components/features': path.resolve(rootDir, 'src/components/features'),
      '@/components': path.resolve(rootDir, 'src/components'),
      '@': rootDir,
      '@src': path.resolve(rootDir, 'src'),
      '@reserve': path.resolve(rootDir, 'reserve'),
      '@app': path.resolve(rootDir, 'reserve/app'),
      '@features': path.resolve(rootDir, 'reserve/features'),
      '@entities': path.resolve(rootDir, 'reserve/entities'),
      '@shared': path.resolve(rootDir, 'reserve/shared'),
      '@pages': path.resolve(rootDir, 'reserve/pages'),
      '@tests': path.resolve(rootDir, 'tests'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    css: true,
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
  },
});
