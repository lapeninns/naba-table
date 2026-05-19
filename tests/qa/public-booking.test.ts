import { describe, expect, it } from 'vitest';

import {
  getDeterministicFutureBookingDate,
  qaTitle,
  QaCleanupRegistry,
  registerPublicBookingCleanup,
} from '@/scripts/qa';

describe('public booking QA helpers', () => {
  it(
    qaTitle('returns a stable venue-local future booking date', ['@p0', '@api', '@contract']),
    () => {
      expect(
        getDeterministicFutureBookingDate({
          daysAhead: 21,
          now: new Date('2026-05-16T23:30:00.000Z'),
          targetWeekday: 5,
          timezone: 'Europe/London',
        }),
      ).toBe('2026-06-12');
    },
  );

  it(
    qaTitle('registers public bookings for QA_RUN_ID cleanup tracking', [
      '@p0',
      '@destructive',
      '@local-only',
      '@staging-ok',
    ]),
    () => {
      const registry = new QaCleanupRegistry({
        env: { QA_RUN_ID: 'qa-public-booking-123' },
        now: () => new Date('2026-05-16T12:00:00.000Z'),
      });

      const record = registerPublicBookingCleanup(registry, {
        bookingId: 'booking-1',
        bookingReference: 'NB123456',
        date: '2026-06-12',
        restaurantId: 'restaurant-1',
      });

      expect(record).toEqual({
        createdAt: '2026-05-16T12:00:00.000Z',
        id: 'booking-1',
        metadata: {
          bookingReference: 'NB123456',
          date: '2026-06-12',
        },
        qaRunId: 'qa-public-booking-123',
        restaurantId: 'restaurant-1',
        status: 'pending',
        type: 'public-booking',
      });
      expect(registry.pending()).toEqual([record]);
    },
  );
});
