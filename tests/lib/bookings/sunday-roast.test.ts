import { describe, expect, it } from 'vitest';

import {
  isSundayBookingDate,
  withFallbackBookingDetail,
  withSundayRoastDetails,
} from '@/lib/bookings/sunday-roast';

describe('Sunday Roast booking helpers', () => {
  it('recognises valid Sundays without depending on the server timezone', () => {
    expect(isSundayBookingDate('2026-07-05')).toBe(true);
    expect(isSundayBookingDate('2026-07-06')).toBe(false);
    expect(isSundayBookingDate('2026-02-30')).toBe(false);
  });

  it('adds structured Sunday Roast metadata without losing existing details', () => {
    expect(withSundayRoastDetails({ channel: 'guest' }, true)).toEqual({
      channel: 'guest',
      occasion: 'Sunday Roast',
      sunday_roast: true,
    });
    expect(withSundayRoastDetails({ channel: 'guest' }, false)).toEqual({ channel: 'guest' });
  });

  it('preserves booking details in the fallback insert payload', () => {
    expect(withFallbackBookingDetail({ occasion: 'Sunday Roast', sunday_roast: true })).toEqual({
      occasion: 'Sunday Roast',
      sunday_roast: true,
      fallback: 'missing_rpc_booking_record',
    });
  });
});
