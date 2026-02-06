import { describe, expect, it } from 'vitest';

import { OPS_GUEST_RETURNING_MIN_BOOKINGS, OPS_GUEST_VIP_MIN_BOOKINGS } from '@/lib/ops/customers';

describe('ops customer segment thresholds', () => {
  it('exports stable VIP/returning thresholds', () => {
    expect(OPS_GUEST_RETURNING_MIN_BOOKINGS).toBe(2);
    expect(OPS_GUEST_VIP_MIN_BOOKINGS).toBe(5);
  });
});

