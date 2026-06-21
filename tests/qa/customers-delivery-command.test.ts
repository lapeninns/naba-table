import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA customers and delivery command', () => {
  it('@p1 @api @browser @dry-run-only selects customers, CSV safety, email delivery, and SMS delivery coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const aggregateCommand = packageJson.scripts?.['qa:customers-delivery'];
    const apiCommand = packageJson.scripts?.['qa:customers-delivery:api'];
    const browserCommand = packageJson.scripts?.['qa:customers-delivery:browser'];

    expect(aggregateCommand).toBe(
      'pnpm run qa:customers-delivery:api && pnpm run qa:customers-delivery:browser',
    );
    expect(apiCommand).toContain('tests/server/ops/customers.test.ts');
    expect(apiCommand).toContain('tests/server/ops-customers-export-route.test.ts');
    expect(apiCommand).toContain('tests/lib/csv-export.test.ts');
    expect(apiCommand).toContain('tests/server/email-delivery-retry-route.test.ts');
    expect(apiCommand).toContain('tests/server/sms-delivery-route.test.ts');
    expect(apiCommand).toContain(
      'tests/components/features/customers/opsCustomersSelectors.test.ts',
    );
    expect(apiCommand).toContain('tests/components/OpsEmailDeliveryClient.test.tsx');
    expect(browserCommand).toBe(
      'playwright test -c playwright.app.config.ts tests/e2e/ops-customers-delivery.spec.ts',
    );
  });
});
