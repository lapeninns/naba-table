import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA observability privacy command', () => {
  it('selects client-error, logging, analytics, artifact, and config safety coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const command = packageJson.scripts?.['qa:observability-privacy'];

    expect(command).toContain('tests/server/client-error-route.test.ts');
    expect(command).toContain('tests/lib/logger-redaction.test.ts');
    expect(command).toContain('tests/lib/analytics-schema.test.ts');
    expect(command).toContain('tests/lib/analytics.test.ts');
    expect(command).toContain('tests/lib/posthog/error-filter.test.ts');
    expect(command).toContain('tests/lib/posthog/pageview.test.ts');
    expect(command).toContain('tests/qa/redaction-tags.test.ts');
    expect(command).toContain('tests/qa/run-id-artifacts.test.ts');
    expect(command).toContain('tests/qa/artifact-sanitizer.test.ts');
    expect(command).toContain('tests/lib/sms-phone-redaction.test.ts');
    expect(command).toContain('tests/server/security-events.test.ts');
    expect(command).toContain('tests/server/sms/bookings-observability.test.ts');
    expect(command).toContain('tests/server/dual-sync-operational-alerts.test.ts');
    expect(command).toContain('tests/config/observability-config.test.ts');
  });
});
