import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The `server-only` Next.js runtime marker is a no-op module at runtime;
      // vitest doesn't ship a resolver for it, so stub it to an empty file.
      'server-only': path.resolve(rootDir, 'tests/stubs/server-only.ts'),
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
      '@/hooks/ops/useOpsBookingSmsDeliveryLog': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingSmsDeliveryLog.ts',
      ),
      '@/hooks/ops/useOpsEmailDeliveryFeed': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsEmailDeliveryFeed.ts',
      ),
      '@/hooks/ops/useOpsRestaurantDetails': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantDetails.ts',
      ),
      '@/hooks/ops/useOpsRestaurantBusinessContext': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantBusinessContext.ts',
      ),
      '@/hooks/ops/useOpsOperatingHours': path.resolve(rootDir, 'src/hooks/ops/useOpsOperatingHours.ts'),
      '@/hooks/ops/useOpsServicePeriods': path.resolve(rootDir, 'src/hooks/ops/useOpsServicePeriods.ts'),
      '@/hooks/ops/useOpsTableTimeline': path.resolve(rootDir, 'src/hooks/ops/useOpsTableTimeline.ts'),
      '@/hooks/ops/useOpsEmailQueueFeed': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsEmailQueueFeed.ts',
      ),
      '@/hooks/ops/useOpsDrinksMenu': path.resolve(rootDir, 'src/hooks/ops/useOpsDrinksMenu.ts'),
      '@/hooks/ops/useOpsGoogleBusinessProfile': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsGoogleBusinessProfile.ts',
      ),
      '@/hooks/useMediaQuery': path.resolve(rootDir, 'src/hooks/useMediaQuery.ts'),
      '@/utils': path.resolve(rootDir, 'src/utils'),
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
