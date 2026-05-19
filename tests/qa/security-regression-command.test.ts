import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA security regression command', () => {
  it('runs the named security regression pack and the service-role guard', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.['qa:security-regression']).toBe(
      'pnpm run security:regression && pnpm run security:guard:service-role',
    );
    expect(packageJson.scripts?.['security:regression']).toContain(
      'tests/server/tenant-authorization-sprint2.test.ts',
    );
    expect(packageJson.scripts?.['security:regression']).toContain(
      'tests/server/csrf-protected-mutations.test.ts',
    );
    expect(packageJson.scripts?.['security:guard:service-role']).toBe(
      'node scripts/security/check-service-role-routes.mjs',
    );
  });
});
