import { describe, expect, it } from 'vitest';

import {
  canRetryEmailDelivery,
  formatOpsEmailDeliveryDuration,
  formatOpsEmailDeliveryRate,
  formatRefreshLabel,
  getOpsEmailDeliveryRefreshIntervalMs,
  resolveRetryDeliveryLogId,
} from '@/components/features/email-delivery/opsEmailDeliveryDomain';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

describe('opsEmailDeliveryDomain', () => {
  it('marks only failed and bounced as retryable', () => {
    expect(canRetryEmailDelivery('failed')).toBe(true);
    expect(canRetryEmailDelivery('bounced')).toBe(true);
    expect(canRetryEmailDelivery('delivered')).toBe(false);
    expect(canRetryEmailDelivery('sent')).toBe(false);
    expect(canRetryEmailDelivery('delivery_delayed')).toBe(false);
    expect(canRetryEmailDelivery('complained')).toBe(false);
  });

  it('formats refresh labels and intervals', () => {
    expect(formatRefreshLabel('off')).toBe('Off');
    expect(formatRefreshLabel('30s')).toBe('30s');
    expect(getOpsEmailDeliveryRefreshIntervalMs('off')).toBe(false);
    expect(getOpsEmailDeliveryRefreshIntervalMs('30s')).toBe(30_000);
    expect(getOpsEmailDeliveryRefreshIntervalMs('1m')).toBe(60_000);
    expect(getOpsEmailDeliveryRefreshIntervalMs('5m')).toBe(300_000);
  });

  it('formats rates and durations', () => {
    expect(formatOpsEmailDeliveryRate(0.833)).toBe('83%');
    expect(formatOpsEmailDeliveryRate(0.083)).toBe('8.3%');
    expect(formatOpsEmailDeliveryRate(0.1)).toBe('10%');
    expect(formatOpsEmailDeliveryDuration(null)).toBe('—');
    expect(formatOpsEmailDeliveryDuration(45)).toBe('45s');
    expect(formatOpsEmailDeliveryDuration(125)).toBe('2m 5s');
  });

  it('resolves retry delivery log id from attempt id first', () => {
    const attempt: OpsEmailDeliveryAttemptDTO = {
      id: '11111111-1111-4111-8111-111111111111',
      messageId: 'provider-message-id',
      recipientEmail: 'failed@example.com',
      bookingId: 'booking-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'resend',
      currentStatus: 'failed',
      currentOccurredAt: '2026-03-20T15:00:00Z',
      events: [
        {
          id: 'evt-1',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'failed@example.com',
          messageId: 'provider-message-id',
          status: 'failed',
          provider: 'resend',
          occurredAt: '2026-03-20T15:00:00Z',
          error: null,
          metadata: null,
        },
      ],
      booking: null,
    };

    expect(resolveRetryDeliveryLogId(attempt)).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('falls back to matching event id when attempt id is missing', () => {
    const attempt: OpsEmailDeliveryAttemptDTO = {
      messageId: 'provider-message-id',
      recipientEmail: 'failed@example.com',
      bookingId: 'booking-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'resend',
      currentStatus: 'failed',
      currentOccurredAt: '2026-03-20T15:00:00Z',
      events: [
        {
          id: 'evt-1',
          bookingId: 'booking-1',
          restaurantId: 'rest-1',
          emailType: 'created',
          templateType: 'booking_confirmation',
          recipientEmail: 'failed@example.com',
          messageId: 'provider-message-id',
          status: 'failed',
          provider: 'resend',
          occurredAt: '2026-03-20T15:00:00Z',
          error: null,
          metadata: null,
        },
      ],
      booking: null,
    };

    expect(resolveRetryDeliveryLogId(attempt)).toBe('evt-1');
  });

  it('returns null when no delivery log id can be resolved', () => {
    const attempt: OpsEmailDeliveryAttemptDTO = {
      messageId: 'provider-message-id',
      recipientEmail: 'failed@example.com',
      bookingId: 'booking-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      provider: 'resend',
      currentStatus: 'failed',
      currentOccurredAt: '2026-03-20T15:00:00Z',
      events: [],
      booking: null,
    };

    expect(resolveRetryDeliveryLogId(attempt)).toBeNull();
  });
});
