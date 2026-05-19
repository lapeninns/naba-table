import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA onboarding command', () => {
  it('selects onboarding auth, API, persistence, tenant, and browser route coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:onboarding']).toBe(
      'pnpm run qa:onboarding:api && pnpm run qa:onboarding:browser',
    );
    expect(packageJson.scripts?.['qa:onboarding:api']).toContain(
      'tests/server/auth/signup-onboarding-route.test.ts',
    );
    expect(packageJson.scripts?.['qa:onboarding:api']).toContain(
      'tests/server/onboarding-restaurant-route-security.test.ts',
    );
    expect(packageJson.scripts?.['qa:onboarding:api']).toContain(
      'tests/components/OnboardingContextPersistence.test.tsx',
    );
    expect(packageJson.scripts?.['qa:onboarding:api']).toContain(
      'tests/server/tenant-authorization-sprint2.test.ts',
    );
    expect(packageJson.scripts?.['qa:onboarding:browser']).toBe(
      'playwright test -c playwright.app.config.ts tests/e2e/onboarding-routes.spec.ts',
    );
  });
});
