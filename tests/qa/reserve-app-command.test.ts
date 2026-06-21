import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA reserve app command', () => {
  it('selects reserve build, reserve API/unit contracts, and reserve browser proof', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:reserve-app']).toBe(
      'pnpm run reserve:build && pnpm run qa:reserve-app:api && pnpm run qa:reserve-app:browser',
    );
    expect(packageJson.scripts?.['qa:reserve-app:api']).toContain(
      'tests/reserve/api-client.test.ts',
    );
    expect(packageJson.scripts?.['qa:reserve-app:api']).toContain(
      'tests/reserve/wizardDraftStorage.test.ts',
    );
    expect(packageJson.scripts?.['qa:reserve-app:api']).toContain(
      'tests/reserve/review-step-capacity-error.test.tsx',
    );
    expect(packageJson.scripts?.['qa:reserve-app:api']).toContain(
      'tests/hooks/useCreateReservation.test.tsx',
    );
    expect(packageJson.scripts?.['qa:reserve-app:api']).toContain(
      'tests/guest/reservationAdapter.test.ts',
    );
    expect(packageJson.scripts?.['qa:reserve-app:browser']).toBe(
      'playwright test -c playwright.reserve.config.ts tests/e2e/guest-reserve-routes.spec.ts',
    );
  });
});
