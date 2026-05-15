import { describe, expect, it } from 'vitest';

import { resolveBookingEndAtUtc } from '@/server/bookings/booking-access';

describe('resolveBookingEndAtUtc', () => {
  it('uses explicit end_at when it is present', () => {
    expect(
      resolveBookingEndAtUtc(
        {
          booking_date: '2026-01-02',
          start_time: '19:00:00',
          end_time: '20:00:00',
          start_at: '2026-01-02T19:00:00.000Z',
          end_at: '2026-01-02T20:30:00.000Z',
        },
        'Europe/London',
      ),
    ).toBe('2026-01-02T20:30:00.000Z');
  });

  it('resolves same-day local end times', () => {
    expect(
      resolveBookingEndAtUtc(
        {
          booking_date: '2026-01-02',
          start_time: '19:00:00',
          end_time: '20:15:00',
          start_at: null,
          end_at: null,
        },
        'Europe/London',
      ),
    ).toBe('2026-01-02T20:15:00.000Z');
  });

  it('resolves midnight as the next day boundary, not 23:59', () => {
    expect(
      resolveBookingEndAtUtc(
        {
          booking_date: '2026-01-02',
          start_time: '23:00:00',
          end_time: '00:00:00',
          start_at: null,
          end_at: null,
        },
        'Europe/London',
      ),
    ).toBe('2026-01-03T00:00:00.000Z');
  });

  it('resolves overnight end times after midnight', () => {
    expect(
      resolveBookingEndAtUtc(
        {
          booking_date: '2026-01-02',
          start_time: '22:30:00',
          end_time: '01:15:00',
          start_at: null,
          end_at: null,
        },
        'Europe/London',
      ),
    ).toBe('2026-01-03T01:15:00.000Z');
  });

  it('uses the restaurant timezone when midnight falls during UK daylight saving time', () => {
    expect(
      resolveBookingEndAtUtc(
        {
          booking_date: '2026-07-03',
          start_time: '22:30:00',
          end_time: '00:00:00',
          start_at: null,
          end_at: null,
        },
        'Europe/London',
      ),
    ).toBe('2026-07-03T23:00:00.000Z');
  });
});
