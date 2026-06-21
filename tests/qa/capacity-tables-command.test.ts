import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA capacity and tables command', () => {
  it('@p1 @api @browser selects deterministic capacity, table assignment, timeline, and shipped route coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const aggregateCommand = packageJson.scripts?.['qa:capacity-tables'];
    const apiCommand = packageJson.scripts?.['qa:capacity-tables:api'];
    const browserCommand = packageJson.scripts?.['qa:capacity-tables:browser'];

    expect(aggregateCommand).toBe(
      'pnpm run qa:capacity-tables:api && pnpm run qa:capacity-tables:browser',
    );
    expect(apiCommand).toContain('tests/server/capacity/availability-status-policy.test.ts');
    expect(apiCommand).toContain('tests/server/capacity/seatability.test.ts');
    expect(apiCommand).toContain('tests/server/capacity/direct-assignment-atomic.test.ts');
    expect(apiCommand).toContain('tests/server/ops-booking-table-assignment-route.test.ts');
    expect(apiCommand).toContain('tests/server/ops-tables-route-security.test.ts');
    expect(apiCommand).toContain('tests/server/ops-tables-timeline-route.test.ts');
    expect(browserCommand).toContain('tests/e2e/ops-capacity-tables.spec.ts');
  });
});
