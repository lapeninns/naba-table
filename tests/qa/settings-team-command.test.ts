import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA settings and team command', () => {
  it('@p1 @api @browser @security selects API and browser settings/team coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const aggregateCommand = packageJson.scripts?.['qa:settings-team'];
    const apiCommand = packageJson.scripts?.['qa:settings-team:api'];
    const browserCommand = packageJson.scripts?.['qa:settings-team:browser'];

    expect(aggregateCommand).toBe(
      'pnpm run qa:settings-team:api && pnpm run qa:settings-team:browser',
    );
    expect(apiCommand).toContain('tests/server/restaurant-settings-layout-security.test.tsx');
    expect(apiCommand).toContain('tests/server/restaurant-details-route.test.ts');
    expect(apiCommand).toContain('tests/server/restaurant-schedule-routes.test.ts');
    expect(apiCommand).toContain('tests/server/restaurant-schedule-replacements.test.ts');
    expect(apiCommand).toContain('tests/server/restaurant-email-template-routes.test.ts');
    expect(apiCommand).toContain('tests/server/team-invitations-security.test.ts');
    expect(apiCommand).toContain('tests/components/RestaurantSettingsRoutePages.test.tsx');
    expect(apiCommand).toContain('tests/components/TeamSettingsComponents.test.tsx');
    expect(browserCommand).toBe(
      'playwright test -c playwright.app.config.ts tests/e2e/ops-settings-team.spec.ts',
    );
  });
});
