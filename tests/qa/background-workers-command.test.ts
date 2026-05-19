import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('QA background workers command', () => {
  it('@p1 @api @worker @security @contract @dry-run-only selects webhook, cron, queue, worker, and config coverage', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };

    const command = packageJson.scripts?.['qa:background-workers'];

    expect(command).toContain('tests/server/resend-webhook-route.test.ts');
    expect(command).toContain('tests/server/twilio-sms-status-webhook-route.test.ts');
    expect(command).toContain('tests/server/cron-routes-auth.test.ts');
    expect(command).toContain('tests/server/email-queue-route.test.ts');
    expect(command).toContain('tests/server/email-processing-security.test.ts');
    expect(command).toContain('tests/server/dual-sync-queue-jobs.test.ts');
    expect(command).toContain('tests/server/dual-sync-queue-worker.test.ts');
    expect(command).toContain('tests/cloudflare/booking-short-links.test.ts');
    expect(command).toContain('tests/cloudflare/sms-summary-gateway.test.ts');
    expect(command).toContain('tests/cloudflare/email-queue-gateway.test.ts');
    expect(command).toContain('tests/config/vercel-crons.test.ts');
  });
});
