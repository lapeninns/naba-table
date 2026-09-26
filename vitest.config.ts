import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

// True only for `vitest run --coverage` (`pnpm test:coverage`). Used to scale
// the per-test timeout below — V8
// instrumentation slows hot loops enough that the planner stress suite
// crosses the default 5s timeout under full-suite worker contention. Plain
// `pnpm test` keeps vitest defaults and is unaffected.
const coverageEnabled = process.argv.includes('--coverage');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The `server-only` Next.js runtime marker is a no-op module at runtime;
      // vitest doesn't ship a resolver for it, so stub it to an empty file.
      'server-only': path.resolve(rootDir, 'tests/stubs/server-only.ts'),
      // Keep vitest resolution aligned with tsconfig "paths" for this hook (implementation lives in src/).
      '@/hooks/useGlobalShortcuts': path.resolve(rootDir, 'src/hooks/useGlobalShortcuts.ts'),
      '@/hooks/use-copy-to-clipboard': path.resolve(rootDir, 'src/hooks/use-copy-to-clipboard.ts'),
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
      '@/hooks/ops/useOpsEmailDeliverySummary': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsEmailDeliverySummary.ts',
      ),
      '@/hooks/ops/useOpsReviewGrowthSummary': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsReviewGrowthSummary.ts',
      ),
      '@/hooks/ops/useOpsRestaurantDetails': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantDetails.ts',
      ),
      '@/hooks/ops/useOpsRestaurantLogoUpload': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantLogoUpload.ts',
      ),
      '@/hooks/ops/useOpsRestaurantBusinessContext': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantBusinessContext.ts',
      ),
      '@/hooks/ops/useOpsTeamInvitations': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsTeamInvitations.ts',
      ),
      '@/hooks/ops/useOpsOperatingHours': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsOperatingHours.ts',
      ),
      '@/hooks/ops/useOpsServicePeriods': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsServicePeriods.ts',
      ),
      '@/hooks/ops/useOccasions': path.resolve(rootDir, 'src/hooks/ops/useOccasions.ts'),
      '@/hooks/ops/useOpsTurnBands': path.resolve(rootDir, 'src/hooks/ops/useOpsTurnBands.ts'),
      '@/hooks/ops/useOpsUpdateBooking': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsUpdateBooking.ts',
      ),
      '@/hooks/ops/useOpsTableTimeline': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsTableTimeline.ts',
      ),
      '@/hooks/ops/useReleaseTableHold': path.resolve(
        rootDir,
        'src/hooks/ops/useReleaseTableHold.ts',
      ),
      '@/hooks/ops/useOpsSaveAvailability': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsSaveAvailability.ts',
      ),
      '@/hooks/ops/useOpsEmailQueueFeed': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsEmailQueueFeed.ts',
      ),
      '@/hooks/ops/useOpsRestaurantSmsDeliveryFeed': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantSmsDeliveryFeed.ts',
      ),
      '@/hooks/ops/useOpsDrinksMenu': path.resolve(rootDir, 'src/hooks/ops/useOpsDrinksMenu.ts'),
      '@/hooks/ops/useOpsGoogleBusinessProfile': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsGoogleBusinessProfile.ts',
      ),
      '@/hooks/ops/useOpsDualSync': path.resolve(rootDir, 'src/hooks/ops/useOpsDualSync.ts'),
      '@/hooks/ops/useOpsTodaySummary': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsTodaySummary.ts',
      ),
      '@/hooks/ops/useOpsBookingStatusSummary': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingStatusSummary.ts',
      ),
      '@/hooks/ops/useOpsBookingsDialogs': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingsDialogs.ts',
      ),
      '@/hooks/ops/useOpsBookingsLifecycleHandlers': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingsLifecycleHandlers.ts',
      ),
      '@/hooks/ops/useOpsEmailTemplatesPageState': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsEmailTemplatesPageState.ts',
      ),
      // Transitive imports of the four hooks above (they also only exist in src/).
      '@/hooks/ops/useOpsBooking': path.resolve(rootDir, 'src/hooks/ops/useOpsBooking.ts'),
      '@/hooks/ops/useOpsCancelBooking': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsCancelBooking.ts',
      ),
      '@/hooks/ops/useOpsBookingStatusActions': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsBookingStatusActions.ts',
      ),
      '@/hooks/ops/useOpsRestaurantEmailTemplates': path.resolve(
        rootDir,
        'src/hooks/ops/useOpsRestaurantEmailTemplates.ts',
      ),
      '@/hooks/ops/utils': path.resolve(rootDir, 'src/hooks/ops/utils'),
      '@/hooks/use-minimum-delay': path.resolve(rootDir, 'src/hooks/use-minimum-delay.ts'),
      '@/hooks/useMediaQuery': path.resolve(rootDir, 'src/hooks/useMediaQuery.ts'),
      '@/utils': path.resolve(rootDir, 'src/utils'),
      '@/app': path.resolve(rootDir, 'src/app'),
      '@/guest': path.resolve(rootDir, 'src/guest'),
      '@/components/ui': path.resolve(rootDir, 'components/ui'),
      '@/components/auth': path.resolve(rootDir, 'components/auth'),
      '@/components/invite': path.resolve(rootDir, 'components/invite'),
      '@/components/features': path.resolve(rootDir, 'src/components/features'),
      '@/components/dashboard': path.resolve(rootDir, 'components/dashboard'),
      '@/components/ops/restaurants/RestaurantDetailsForm': path.resolve(
        rootDir,
        'components/ops/restaurants/RestaurantDetailsForm.tsx',
      ),
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
    // Coverage runs only: see `coverageEnabled` note above. Not set for
    // plain runs, so vitest's default (5s) still applies to `pnpm test`.
    ...(coverageEnabled ? { testTimeout: 30_000 } : {}),
    // Coverage is only active under `--coverage`; plain `pnpm test` behavior
    // and timing are unchanged. Vitest 4 removed `coverage.all`, so leaving
    // `include` unset measures only files loaded by the suite.
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
      // Reports are still written when the suite is red so a failing run can
      // be inspected while the test command still reports the failure.
      reportOnFailure: true,
      thresholds: {
        branches: 55,
        functions: 70,
        lines: 65,
        statements: 65,
      },
      exclude: [
        'tests/**',
        '**/node_modules/**',
        '.next/**',
        'reserve/.storybook/**',
        'reserve/storybook-static/**',
        '**/*.stories.{ts,tsx}',
        '**/*.config.{js,cjs,mjs,ts,mts,cts}',
        '**/*.d.ts',
        'types/**',
      ],
    },
  },
});
