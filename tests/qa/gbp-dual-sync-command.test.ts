import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA GBP dual-sync command', () => {
  it('@p2 @api @browser @dry-run-only @external-mock selects GBP route contracts, dual-sync dry-run boundaries, and shipped settings UI proof', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:gbp-dual-sync']).toBe(
      'pnpm run qa:gbp-dual-sync:api && pnpm run qa:gbp-dual-sync:ui && pnpm run qa:gbp-dual-sync:browser',
    );

    const apiCommand = packageJson.scripts?.['qa:gbp-dual-sync:api'];
    expect(apiCommand).toContain('tests/server/restaurant-google-business-profile-routes.test.ts');
    expect(apiCommand).toContain(
      'tests/server/restaurant-google-business-profile-core-sync-routes.test.ts',
    );
    expect(apiCommand).toContain('tests/server/google-business-profile-readonly-v1.test.ts');
    expect(apiCommand).toContain('tests/server/google-business-profile-callback-route.test.ts');
    expect(apiCommand).toContain('tests/server/dual-sync-state-refresh-routes.test.ts');
    expect(apiCommand).toContain('tests/server/dual-sync-candidates-route.test.ts');
    expect(apiCommand).toContain('tests/server/dual-sync-publish-preview-route.test.ts');
    expect(apiCommand).toContain('tests/server/dual-sync-publish-route.test.ts');
    expect(apiCommand).toContain('tests/server/dual-sync-google-audit.test.ts');

    const uiCommand = packageJson.scripts?.['qa:gbp-dual-sync:ui'];
    expect(uiCommand).toContain('tests/components/RestaurantSettingsRoutePages.test.tsx');
    expect(uiCommand).toContain('tests/components/RestaurantSettingsShell.test.tsx');
    expect(uiCommand).toContain('tests/components/GoogleBusinessProfileSection.test.tsx');
    expect(uiCommand).toContain('tests/components/DualSyncShellPublishFlow.test.tsx');

    const browserCommand = packageJson.scripts?.['qa:gbp-dual-sync:browser'];
    expect(browserCommand).toBe(
      'playwright test -c playwright.app.config.ts tests/e2e/ops-gbp-dual-sync.spec.ts',
    );
  });
});
