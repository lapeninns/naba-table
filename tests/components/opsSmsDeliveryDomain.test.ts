import { describe, expect, it } from 'vitest';

import {
  formatSmsStuckForHint,
  getSmsDeliveryFailureCount,
  getSmsDeliveryRatePercent,
  OPS_SMS_DELIVERY_PAGE_SIZE_OPTIONS,
  OPS_SMS_DELIVERY_RANGE_OPTIONS,
  OPS_SMS_DELIVERY_STATUS_FILTERS,
} from '@/components/features/sms-delivery/opsSmsDeliveryDomain';

describe('opsSmsDeliveryDomain', () => {
  it('exposes stable filter option lists', () => {
    expect(OPS_SMS_DELIVERY_PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
    expect(OPS_SMS_DELIVERY_RANGE_OPTIONS.map((option) => option.value)).toEqual([
      '24h',
      '7d',
      '30d',
    ]);
    expect(OPS_SMS_DELIVERY_STATUS_FILTERS.map((option) => option.value)).toEqual([
      'queued',
      'sent',
      'delivered',
      'undelivered',
      'failed',
    ]);
  });

  it('formats stale SMS duration hints', () => {
    expect(formatSmsStuckForHint(null)).toBeNull();
    expect(formatSmsStuckForHint(0)).toBeNull();
    expect(formatSmsStuckForHint(30_000)).toBe('stuck 1m');
    expect(formatSmsStuckForHint(45 * 60_000)).toBe('stuck 45m');
    expect(formatSmsStuckForHint(3 * 60 * 60_000)).toBe('stuck 3h');
  });

  it('derives summary metric values defensively', () => {
    expect(
      getSmsDeliveryFailureCount({
        total: 10,
        queued: 1,
        sent: 1,
        delivered: 6,
        undelivered: 2,
        failed: 1,
        deliveredRate: 0.6,
        failureRate: 0.3,
        uniqueRecipients: 5,
        uniqueBookings: 4,
      }),
    ).toBe(3);
    expect(getSmsDeliveryRatePercent(0.751)).toBe(75);
    expect(getSmsDeliveryRatePercent(Number.NaN)).toBe(0);
  });
});
