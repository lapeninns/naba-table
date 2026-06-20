import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getVenuePolicy, type VenuePolicy } from '@/server/capacity/policy';
import { computeBookingWindow } from '@/server/capacity/table-assignment/booking-window';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';

// On the US/Eastern spring-forward date (2026-03-08) clocks jump 02:00 -> 03:00,
// so the local wall-clock time 02:30 does not exist. Luxon's
// DateTime.fromISO('2026-03-08T02:30', { zone }) returns isValid:true but
// silently shifts to 03:30. The booking-window builder must NOT accept that
// coercion silently.
const DST_DATE = '2026-03-08';
const NON_EXISTENT_TIME = '02:30';
const VALID_TIME = '19:00';

// A venue policy whose service window spans the (skipped) early-morning DST
// hour. This is deliberate: it means that on the OLD (unfixed) code the
// coerced 03:30 still lands inside a service window, so the only reason the
// request can fail is the new DST round-trip guard — not an incidental
// ServiceNotFoundError. (Lunch is the first service in serviceOrder and is the
// one whichService resolves to here.)
function easternPolicyCoveringDstHour(): VenuePolicy {
  const base = getVenuePolicy({ timezone: 'America/New_York' });
  return {
    ...base,
    services: {
      ...base.services,
      lunch: {
        ...base.services.lunch!,
        start: { hour: 2, minute: 0 },
        end: { hour: 5, minute: 0 },
      },
    },
  };
}

describe('#6 booking-window rejects DST spring-forward non-existent times', () => {
  it('confirms the underlying Luxon coercion this guard defends against', () => {
    const coerced = DateTime.fromISO(`${DST_DATE}T${NON_EXISTENT_TIME}`, {
      zone: 'America/New_York',
    });
    // Luxon does not flag the skipped time as invalid...
    expect(coerced.isValid).toBe(true);
    // ...it silently advances 02:30 -> 03:30.
    expect(coerced.toFormat('HH:mm')).toBe('03:30');
  });

  it('throws INVALID_START instead of silently shifting 02:30 to 03:30', () => {
    expect(() =>
      computeBookingWindow({
        bookingDate: DST_DATE,
        startTime: NON_EXISTENT_TIME,
        partySize: 2,
        policy: easternPolicyCoveringDstHour(),
      }),
    ).toThrow(ManualSelectionInputError);

    try {
      computeBookingWindow({
        bookingDate: DST_DATE,
        startTime: NON_EXISTENT_TIME,
        partySize: 2,
        policy: easternPolicyCoveringDstHour(),
      });
      throw new Error('expected computeBookingWindow to throw for a non-existent DST time');
    } catch (error) {
      expect(error).toBeInstanceOf(ManualSelectionInputError);
      expect((error as ManualSelectionInputError).code).toBe('INVALID_START');
    }
  });

  it('leaves a normal in-service time untouched and round-trips its HH:mm', () => {
    const policy = getVenuePolicy({ timezone: 'America/New_York' });
    const window = computeBookingWindow({
      bookingDate: DST_DATE,
      startTime: VALID_TIME,
      partySize: 2,
      policy,
    });

    expect(window.service).toBe('dinner');
    // The requested wall-clock time survives the build unchanged.
    expect(window.dining.start.toFormat('HH:mm')).toBe(VALID_TIME);
    expect(window.dining.start.zoneName).toBe('America/New_York');
  });
});
