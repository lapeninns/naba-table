import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA performance command', () => {
  it('selects thresholded smoke and high-risk API/worker timing surfaces', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const command = packageJson.scripts?.['qa:performance'];

    expect(command).toContain('tests/performance/qa-performance-smoke.test.ts');
    expect(command).toContain('tests/server/availability-route-query-params.test.ts');
    expect(command).toContain('tests/server/ops-bookings-create-capacity.test.ts');
    expect(command).toContain('tests/server/capacity/seatability.test.ts');
    expect(command).toContain('tests/server/ops-dashboard-summary-route.test.ts');
    expect(command).toContain('tests/server/ops-dashboard-changes-route.test.ts');
    expect(command).toContain('tests/server/ops-customers-export-route.test.ts');
    expect(command).toContain('tests/server/email-delivery-log-attempts.test.ts');
    expect(command).toContain('tests/server/sms-delivery-route.test.ts');
    expect(command).toContain('tests/cloudflare/booking-short-links.test.ts');
    expect(command).toContain('tests/cloudflare/sms-summary-gateway.test.ts');
  });
});
