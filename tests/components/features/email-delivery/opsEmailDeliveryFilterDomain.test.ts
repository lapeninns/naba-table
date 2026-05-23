import { describe, expect, it } from 'vitest';

import {
  EMAIL_DELIVERY_RANGE_OPTIONS,
  EMAIL_TYPE_OPTIONS,
  SEARCH_FIELD_LABELS,
  SEARCH_FIELD_PLACEHOLDERS,
  TEMPLATE_TYPE_OPTIONS,
  formatEmailDeliveryFilterOptionLabel,
  getEmailDeliveryStatusFilterOptions,
  resolveOpsEmailDeliveryRangeChange,
} from '@/components/features/email-delivery/opsEmailDeliveryFilterDomain';

describe('opsEmailDeliveryFilterDomain', () => {
  it('keeps search field labels and placeholders centralized', () => {
    expect(SEARCH_FIELD_LABELS).toEqual({
      recipientEmail: 'Email',
      messageId: 'Message ID',
      bookingRef: 'Booking Ref',
    });
    expect(SEARCH_FIELD_PLACEHOLDERS.bookingRef).toBe('ABC123');
  });

  it('defines filter option sets used by the filter bar compatibility exports', () => {
    expect(TEMPLATE_TYPE_OPTIONS).toContain('booking_confirmation');
    expect(TEMPLATE_TYPE_OPTIONS).toContain('reminder_short');
    expect(EMAIL_TYPE_OPTIONS).toContain('created');
    expect(EMAIL_TYPE_OPTIONS).toContain('restaurant_cancellation');
  });

  it('resolves range changes only for supported changed values', () => {
    expect(EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => option.value)).toEqual([
      '24h',
      '7d',
      '30d',
    ]);
    expect(resolveOpsEmailDeliveryRangeChange('24h', '7d')).toBe('24h');
    expect(resolveOpsEmailDeliveryRangeChange('7d', '7d')).toBeNull();
    expect(resolveOpsEmailDeliveryRangeChange('90d', '7d')).toBeNull();
  });

  it('formats option labels and builds accessible status options', () => {
    expect(formatEmailDeliveryFilterOptionLabel('booking_confirmation')).toBe(
      'booking confirmation',
    );
    expect(getEmailDeliveryStatusFilterOptions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'failed',
          label: 'Failed',
          toneClass: expect.stringContaining('destructive'),
        }),
      ]),
    );
  });
});
