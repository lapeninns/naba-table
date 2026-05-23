import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getVenuePolicy, ServiceOverrunError } from '@/server/capacity/policy';
import {
  buildManualBookingWindowArgs,
  resolveManualBookingTimezone,
  resolveManualBookingWindow,
  translateManualBookingWindowError,
  type ManualBookingRecord,
} from '@/server/capacity/table-assignment/manual-booking-context';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';

function makeBooking(overrides: Partial<ManualBookingRecord> = {}): ManualBookingRecord {
  return {
    id: 'booking-1',
    restaurant_id: 'restaurant-1',
    start_at: '2026-05-23T18:00:00.000Z',
    booking_date: '2026-05-23',
    start_time: '18:00',
    party_size: 4,
    booking_type: 'dinner',
    assigned_zone_id: null,
    restaurants: {
      timezone: 'Europe/London',
    },
    ...overrides,
  } as ManualBookingRecord;
}

describe('manual booking context', () => {
  it('prefers the booking restaurant timezone over the fallback timezone', () => {
    expect(
      resolveManualBookingTimezone({
        booking: makeBooking(),
        fallbackTimezone: 'UTC',
      }),
    ).toBe('Europe/London');
  });

  it('uses the fallback timezone when the booking row has no joined restaurant timezone', () => {
    expect(
      resolveManualBookingTimezone({
        booking: makeBooking({ restaurants: null }),
        fallbackTimezone: 'UTC',
      }),
    ).toBe('UTC');
  });

  it('projects booking fields into booking-window arguments', () => {
    const policy = getVenuePolicy({ timezone: 'Europe/London' });

    expect(buildManualBookingWindowArgs({ booking: makeBooking(), policy })).toEqual({
      startISO: '2026-05-23T18:00:00.000Z',
      bookingDate: '2026-05-23',
      startTime: '18:00',
      partySize: 4,
      bookingOption: 'dinner',
      policy,
    });
  });

  it('resolves a manual booking window with the shared booking-window helper', () => {
    const policy = getVenuePolicy({ timezone: 'Europe/London' });
    const window = resolveManualBookingWindow({
      booking: makeBooking(),
      policy,
    });

    expect(window.block.start.isValid).toBe(true);
    expect(window.block.end > window.block.start).toBe(true);
  });

  it('translates service overrun errors into manual selection input errors', () => {
    expect(() =>
      translateManualBookingWindowError(
        new ServiceOverrunError(
          'dinner',
          DateTime.fromISO('2026-05-23T18:00:00.000Z'),
          DateTime.fromISO('2026-05-23T18:00:00.000Z'),
        ),
      ),
    ).toThrow(ManualSelectionInputError);

    try {
      translateManualBookingWindowError(
        new ServiceOverrunError(
          'dinner',
          DateTime.fromISO('2026-05-23T18:00:00.000Z'),
          DateTime.fromISO('2026-05-23T18:00:00.000Z'),
        ),
      );
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SERVICE_OVERRUN',
        status: 422,
      });
    }
  });
});
