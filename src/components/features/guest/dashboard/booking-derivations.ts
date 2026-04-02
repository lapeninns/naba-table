import { getBookingDateTimeMillis } from '@reserve/shared/formatting/bookingDateTime';

import type { BookingDTO } from '@/hooks/useBookings';

export type FavoriteRestaurant = {
  name: string;
  count: number;
  slug?: string | null;
};

type DerivedState = {
  liveBooking: BookingDTO | null;
  nextBooking: BookingDTO | null;
  favorites: FavoriteRestaurant[];
  total: number;
};

const INACTIVE_STATUSES = new Set<BookingDTO['status']>(['cancelled', 'no_show', 'completed']);

function parseDate(value: string | null | undefined, timezone?: string | null): Date | null {
  const millis = getBookingDateTimeMillis(value, timezone);
  return millis === null ? null : new Date(millis);
}

function isLive(booking: BookingDTO, now: Date): boolean {
  if (booking.status === 'checked_in') return true;
  const start = parseDate(booking.startIso, booking.restaurantTimezone);
  const end =
    parseDate(booking.endIso, booking.restaurantTimezone) ??
    parseDate(booking.startIso, booking.restaurantTimezone);
  if (!start || !end) return false;
  return start <= now && now <= end;
}

function isUpcomingActive(booking: BookingDTO, now: Date): boolean {
  if (INACTIVE_STATUSES.has(booking.status)) return false;
  const start = parseDate(booking.startIso, booking.restaurantTimezone);
  if (!start) return false;
  return start.getTime() >= now.getTime();
}

function compareByStart(a: BookingDTO, b: BookingDTO): number {
  const aDate = parseDate(a.startIso, a.restaurantTimezone)?.getTime() ?? 0;
  const bDate = parseDate(b.startIso, b.restaurantTimezone)?.getTime() ?? 0;
  return aDate - bDate;
}

export function deriveBookingState(bookings: BookingDTO[] = []): DerivedState {
  const now = new Date();
  const safeBookings = bookings.filter((b) => Boolean(parseDate(b.startIso, b.restaurantTimezone)));

  const liveBooking = safeBookings.find((booking) => isLive(booking, now)) ?? null;

  const upcomingSorted = safeBookings
    .filter((booking) => isUpcomingActive(booking, now) && !isLive(booking, now))
    .sort(compareByStart);

  const nextBooking = upcomingSorted[0] ?? null;

  const favorites = Array.from(
    safeBookings.reduce<Map<string, FavoriteRestaurant>>((acc, booking) => {
      if (!booking.restaurantName) return acc;
      const current = acc.get(booking.restaurantName) ?? { name: booking.restaurantName, count: 0, slug: booking.restaurantSlug ?? null };
      acc.set(booking.restaurantName, { ...current, count: current.count + 1, slug: current.slug ?? booking.restaurantSlug ?? null });
      return acc;
    }, new Map()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    liveBooking,
    nextBooking,
    favorites,
    total: safeBookings.length,
  };
}
