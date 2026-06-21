import { describe, expect, it } from 'vitest';

import { sanitizeAnalyticsProps } from '@/lib/analytics/schema';

describe('analytics schema allowlist', () => {
  it('keeps allowlisted props and strips query strings from route-like values', () => {
    expect(
      sanitizeAnalyticsProps({
        type: 'error',
        path: '/bookings/recover?access_token=secret',
        redirectedFrom: '/guest/dashboard?token_hash=secret',
        referrer: 'https://evil.example/start?code=secret',
        arbitrary: 'drop-me',
        email: 'guest@example.com',
      }),
    ).toEqual({
      type: 'error',
      path: '/bookings/recover',
      redirectedFrom: '/guest/dashboard',
      referrer: 'https://evil.example/start',
    });
  });

  it('keeps the newly added instrumentation props', () => {
    expect(
      sanitizeAnalyticsProps({
        step: 'review',
        reason: 'capacity_full',
        slotCount: 3,
        jobName: 'process-emails',
        runId: 'run-123',
        draftId: 'draft-1',
        assignedCount: 2,
        retryable: true,
        provider: 'resend',
        available: false,
      }),
    ).toEqual({
      step: 'review',
      reason: 'capacity_full',
      slotCount: 3,
      jobName: 'process-emails',
      runId: 'run-123',
      draftId: 'draft-1',
      assignedCount: 2,
      retryable: true,
      provider: 'resend',
      available: false,
    });
  });

  it('drops PII and re-identifying ids that are intentionally not allowlisted', () => {
    expect(
      sanitizeAnalyticsProps({
        bookingId: 'booking-1',
        restaurantId: 'restaurant-1',
        deliveryLogId: 'log-with-pii-join',
        idempotencyKey: 'idem-key',
        email: 'guest@example.com',
        phone: '+441234567890',
        recoveryToken: 'secret-token',
      }),
    ).toEqual({
      bookingId: 'booking-1',
      restaurantId: 'restaurant-1',
    });
  });
});
