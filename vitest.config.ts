import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Keep vitest resolution aligned with tsconfig "paths" for this hook (implementation lives in src/).
      '@/hooks/useGlobalShortcuts': path.resolve(rootDir, 'src/hooks/useGlobalShortcuts.ts'),
      // Contexts live under src/ (no root-level contexts/ directory).
      '@/contexts': path.resolve(rootDir, 'src/contexts'),
      // Ops/service layer lives under src/.
      '@/services': path.resolve(rootDir, 'src/services'),
      // Some ops hooks only exist under src/hooks/ops (tsconfig has a fallback path).
      '@/hooks/ops/useOpsBookingEmailDeliveryLog': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingEmailDeliveryLog.ts',
      ),
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
