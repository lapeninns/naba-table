import { DateTime } from 'luxon';

import {
  formatReservationDateFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
  resolveBookingTimezone,
} from '@reserve/shared/formatting/bookingDateTime';

import type { BookingDTO } from '@/guest/services/ports';

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

export type GuestDashboardUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

export type GuestDashboardProfileLike =
  | {
      name?: string | null;
    }
  | null
  | undefined;

export type GuestDashboardViewState = {
  firstName: string;
  heroName: string;
  primaryBooking: BookingDTO | null;
  upcomingList: BookingDTO[];
};

export type GuestDashboardFeaturedBookingDisplay = {
  dateLabel: string;
  isToday: boolean;
  partyLabel: string;
  statusLabel: string;
  timeLabel: string;
};

export type GuestDashboardUpcomingBookingDisplay = {
  dayLabel: string;
  monthLabel: string;
  partyLabel: string;
  timeLabel: string;
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

export function deriveBookingState(bookings: BookingDTO[] = [], now = new Date()): DerivedState {
  const safeBookings = bookings.filter((b) => Boolean(parseDate(b.startIso, b.restaurantTimezone)));

  const liveBooking = safeBookings.find((booking) => isLive(booking, now)) ?? null;

  const upcomingSorted = safeBookings
    .filter((booking) => isUpcomingActive(booking, now) && !isLive(booking, now))
    .sort(compareByStart);

  const nextBooking = upcomingSorted[0] ?? null;

  const favorites = Array.from(
    safeBookings.reduce<Map<string, FavoriteRestaurant>>((acc, booking) => {
      if (!booking.restaurantName) return acc;
      const current = acc.get(booking.restaurantName) ?? {
        name: booking.restaurantName,
        count: 0,
        slug: booking.restaurantSlug ?? null,
      };
      acc.set(booking.restaurantName, {
        ...current,
        count: current.count + 1,
        slug: current.slug ?? booking.restaurantSlug ?? null,
      });
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

export function resolveGuestDashboardHeroName({
  profile,
  user,
}: {
  profile: GuestDashboardProfileLike;
  user: GuestDashboardUserLike | undefined;
}): string {
  const metadata = user?.user_metadata ?? null;
  const fullName =
    typeof metadata?.['full_name'] === 'string' ? (metadata['full_name'] as string) : null;
  return fullName || profile?.name || user?.email?.split('@')[0] || 'Guest';
}

export function resolveGuestDashboardFirstName(heroName: string): string {
  return heroName.split(' ')[0] || 'Guest';
}

export function deriveGuestDashboardUpcomingList({
  bookings,
  primaryBookingId,
  now = Date.now(),
}: {
  bookings: BookingDTO[];
  primaryBookingId?: string | null;
  now?: number;
}): BookingDTO[] {
  return bookings
    .filter((booking) => {
      if (booking.id === primaryBookingId) return false;
      if (['cancelled', 'no_show', 'completed'].includes(booking.status)) return false;
      const start = getBookingDateTimeMillis(booking.startIso, booking.restaurantTimezone);
      return start !== null && start >= now;
    })
    .sort(
      (a, b) =>
        (getBookingDateTimeMillis(a.startIso, a.restaurantTimezone) ?? 0) -
        (getBookingDateTimeMillis(b.startIso, b.restaurantTimezone) ?? 0),
    );
}

export function formatGuestDashboardBookingStatus(status: BookingDTO['status']): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatGuestDashboardPartyLabel(partySize: number): string {
  return `${partySize} ${partySize === 1 ? 'guest' : 'guests'}`;
}

export function buildGuestDashboardFeaturedBookingDisplay({
  booking,
  now = new Date(),
}: {
  booking: BookingDTO;
  now?: Date;
}): GuestDashboardFeaturedBookingDisplay {
  const bookingDateTime = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);
  const bookingDate = bookingDateTime?.toJSDate() ?? null;
  const timezone = booking.restaurantTimezone ?? undefined;
  const isToday = bookingDateTime
    ? bookingDateTime.hasSame(
        DateTime.fromJSDate(now).setZone(resolveBookingTimezone(booking.restaurantTimezone)),
        'day',
      )
    : false;

  return {
    dateLabel: bookingDate
      ? formatReservationDateFromDate(bookingDate, {
          timezone,
        })
      : 'Date pending',
    isToday,
    partyLabel: formatGuestDashboardPartyLabel(booking.partySize),
    statusLabel: formatGuestDashboardBookingStatus(booking.status),
    timeLabel: bookingDate
      ? formatReservationTimeFromDate(bookingDate, {
          timezone,
        })
      : 'Time pending',
  };
}

export function buildGuestDashboardUpcomingBookingDisplay(
  booking: BookingDTO,
): GuestDashboardUpcomingBookingDisplay {
  const bookingDateTime = parseBookingDateTime(booking.startIso, booking.restaurantTimezone);

  return {
    dayLabel: bookingDateTime?.toFormat('d') ?? '--',
    monthLabel: bookingDateTime?.setLocale('en').toFormat('MMM') ?? 'TBC',
    partyLabel: formatGuestDashboardPartyLabel(booking.partySize),
    timeLabel: bookingDateTime
      ? formatReservationTimeFromDate(bookingDateTime.toJSDate(), {
          timezone: booking.restaurantTimezone ?? undefined,
        })
      : 'Time pending',
  };
}

export function deriveGuestDashboardViewState({
  bookings,
  profile,
  user,
  now = new Date(),
}: {
  bookings: BookingDTO[];
  profile: GuestDashboardProfileLike;
  user: GuestDashboardUserLike | undefined;
  now?: Date;
}): GuestDashboardViewState {
  const derived = deriveBookingState(bookings, now);
  const primaryBooking = derived.liveBooking ?? derived.nextBooking ?? null;
  const heroName = resolveGuestDashboardHeroName({ profile, user });

  return {
    firstName: resolveGuestDashboardFirstName(heroName),
    heroName,
    primaryBooking,
    upcomingList: deriveGuestDashboardUpcomingList({
      bookings,
      primaryBookingId: primaryBooking?.id,
      now: now.getTime(),
    }),
  };
}
