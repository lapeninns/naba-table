import { describe, expect, it, vi } from 'vitest';

const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

import { recordSecurityEvent } from '@/server/security/events';

describe('security event observability', () => {
  it('namespaces security events and redacts sensitive context keys', async () => {
    await recordSecurityEvent({
      eventType: 'cron_auth_failure',
      source: 'test.security',
      severity: 'error',
      restaurantId: 'restaurant-1',
      context: {
        authorization: 'Bearer secret',
        nested: {
          token_hash: 'raw-token-hash',
          safeReason: 'unauthorized',
        },
        longValue: 'x'.repeat(300),
      },
    });

    expect(recordObservabilityEventMock).toHaveBeenCalledWith({
      source: 'test.security',
      eventType: 'security.cron_auth_failure',
      severity: 'error',
      restaurantId: 'restaurant-1',
      bookingId: null,
      context: {
        authorization: '[redacted]',
        nested: {
          token_hash: '[redacted]',
          safeReason: 'unauthorized',
        },
        longValue: `${'x'.repeat(253)}...`,
      },
    });
  });
});
