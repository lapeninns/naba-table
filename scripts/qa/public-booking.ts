import { DateTime } from 'luxon';

import type { QaCleanupRecord, QaCleanupRegistry } from './cleanup-registry';

export type DeterministicFutureBookingDateOptions = {
  daysAhead?: number;
  now?: Date;
  targetWeekday?: number;
  timezone?: string;
};

export type PublicBookingCleanupInput = {
  bookingId: string;
  bookingReference?: string;
  date?: string;
  restaurantId: string;
};

export function getDeterministicFutureBookingDate(
  options: DeterministicFutureBookingDateOptions = {},
): string {
  const timezone = options.timezone ?? 'Europe/London';
  const daysAhead = Math.max(1, options.daysAhead ?? 21);
  let date = DateTime.fromJSDate(options.now ?? new Date(), { zone: timezone })
    .startOf('day')
    .plus({ days: daysAhead });

  if (options.targetWeekday !== undefined) {
    const targetWeekday = Math.min(7, Math.max(1, options.targetWeekday));
    const delta = (targetWeekday - date.weekday + 7) % 7;
    date = date.plus({ days: delta });
  }

  const isoDate = date.toISODate();
  if (!isoDate) {
    throw new Error('Unable to resolve deterministic future booking date.');
  }

  return isoDate;
}

export function registerPublicBookingCleanup(
  registry: QaCleanupRegistry,
  input: PublicBookingCleanupInput,
): QaCleanupRecord {
  return registry.register({
    id: input.bookingId,
    metadata: {
      bookingReference: input.bookingReference ?? null,
      date: input.date ?? null,
    },
    restaurantId: input.restaurantId,
    type: 'public-booking',
  });
}
