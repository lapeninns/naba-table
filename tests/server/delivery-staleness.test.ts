import { describe, expect, it } from 'vitest';

import { computeEmailAttemptStaleness } from '@/server/emails/email-delivery-log';
import { computeSmsAttemptStaleness } from '@/server/sms/delivery-log';

const HOUR_MS = 60 * 60 * 1000;

describe('computeEmailAttemptStaleness', () => {
  const now = new Date('2026-01-15T12:00:00.000Z').getTime();

  it('flags sent attempts older than the 12h threshold as stale', () => {
    const result = computeEmailAttemptStaleness({
      currentStatus: 'sent',
      currentOccurredAt: new Date(now - 13 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(true);
    expect(result.stuckForMs).toBeGreaterThan(12 * HOUR_MS);
  });

  it('does not flag sent attempts within the threshold', () => {
    const result = computeEmailAttemptStaleness({
      currentStatus: 'sent',
      currentOccurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(false);
    expect(result.stuckForMs).toBeNull();
  });

  it('flags delivery_delayed attempts past the threshold', () => {
    const result = computeEmailAttemptStaleness({
      currentStatus: 'delivery_delayed',
      currentOccurredAt: new Date(now - 24 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(true);
  });

  it('never flags terminal statuses', () => {
    for (const status of ['delivered', 'bounced', 'complained', 'failed'] as const) {
      const result = computeEmailAttemptStaleness({
        currentStatus: status,
        currentOccurredAt: new Date(now - 10 * 24 * HOUR_MS).toISOString(),
        now,
      });
      expect(result.isStale, `${status} should not be stale`).toBe(false);
    }
  });

  it('handles missing timestamps gracefully', () => {
    const result = computeEmailAttemptStaleness({
      currentStatus: 'sent',
      currentOccurredAt: null,
      now,
    });
    expect(result.isStale).toBe(false);
  });
});

describe('computeSmsAttemptStaleness', () => {
  const now = new Date('2026-01-15T12:00:00.000Z').getTime();

  it('flags queued attempts older than the 12h threshold', () => {
    const result = computeSmsAttemptStaleness({
      currentStatus: 'queued',
      currentOccurredAt: new Date(now - 13 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(true);
  });

  it('flags sent attempts older than the 12h threshold', () => {
    const result = computeSmsAttemptStaleness({
      currentStatus: 'sent',
      currentOccurredAt: new Date(now - 13 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(true);
  });

  it('does not flag sent attempts within the threshold', () => {
    const result = computeSmsAttemptStaleness({
      currentStatus: 'sent',
      currentOccurredAt: new Date(now - 6 * HOUR_MS).toISOString(),
      now,
    });
    expect(result.isStale).toBe(false);
  });

  it('never flags terminal statuses', () => {
    for (const status of ['delivered', 'undelivered', 'failed'] as const) {
      const result = computeSmsAttemptStaleness({
        currentStatus: status,
        currentOccurredAt: new Date(now - 10 * HOUR_MS).toISOString(),
        now,
      });
      expect(result.isStale, `${status} should not be stale`).toBe(false);
    }
  });
});
