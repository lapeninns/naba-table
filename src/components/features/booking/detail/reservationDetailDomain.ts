import {
  getPendingSelfServeGraceMinutes,
  isPendingSelfServeLocked,
} from '@/lib/bookings/pendingLock';
import {
  formatReservationDateFromDate,
  formatReservationDateShortFromDate,
  formatReservationTimeFromDate,
} from '@reserve/shared/formatting/booking';
import {
  getBookingDateTimeMillis,
  parseBookingDateTime,
} from '@reserve/shared/formatting/bookingDateTime';
import { DEFAULT_VENUE } from '@shared/config/venue';

import type { BookingDTO } from '@/hooks/useBookings';
import type { ReservationSharePayload, ShareResult } from '@/lib/reservations/share';
import type { Reservation } from '@entities/reservation/reservation.schema';

export type ReservationVenue = {
  name: string;
  address: string;
  timezone: string;
  slug?: string | null;
};

export type ReservationDisplay = {
  shortDate: string;
  fullDate: string;
  time: string;
};

export type ReservationStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'default';

export type ReservationStatusConfig = {
  label: string;
  tone: ReservationStatusTone;
  iconKey: 'confirmed' | 'cancelled' | 'pending' | 'checkedIn' | 'default';
};

export type PendingLockState = {
  locked: boolean;
  lockTimestamp: number | null;
};

export const FALLBACK_RESERVATION_DISPLAY: ReservationDisplay = {
  shortDate: '—',
  fullDate: '—',
  time: '—',
};

export function feedbackTone(variant: ShareResult['variant']): ReservationStatusTone {
  if (variant === 'error') return 'danger';
  return variant;
}

export function calendarStatusFromReservation(
  status: string,
): NonNullable<ReservationSharePayload['status']> {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'pending' || status === 'pending_allocation') return 'pending';
  return 'confirmed';
}

export function buildReservationDisplay(
  startIso: string | null | undefined,
  timezone: string | null | undefined,
): ReservationDisplay {
  if (!startIso) {
    return FALLBACK_RESERVATION_DISPLAY;
  }

  const parsed = parseBookingDateTime(startIso, timezone)?.toJSDate();
  if (!parsed) {
    return FALLBACK_RESERVATION_DISPLAY;
  }

  const formattingOptions = timezone ? { timezone } : undefined;
  const shortDate =
    formatReservationDateShortFromDate(parsed, formattingOptions) ||
    FALLBACK_RESERVATION_DISPLAY.shortDate;
  const fullDate =
    formatReservationDateFromDate(parsed, formattingOptions) ||
    FALLBACK_RESERVATION_DISPLAY.fullDate;
  const time =
    formatReservationTimeFromDate(parsed, formattingOptions) || FALLBACK_RESERVATION_DISPLAY.time;

  return { shortDate, fullDate, time };
}

export function buildReservationVenue(params: {
  providedVenue?: ReservationVenue | null;
  reservation?: Reservation;
  restaurantName: string | null;
}): ReservationVenue {
  const { providedVenue, reservation, restaurantName } = params;
  if (providedVenue) {
    return {
      name: providedVenue.name ?? DEFAULT_VENUE.name,
      address: providedVenue.address ?? DEFAULT_VENUE.address,
      timezone: providedVenue.timezone ?? DEFAULT_VENUE.timezone,
      slug: providedVenue.slug ?? DEFAULT_VENUE.slug,
    };
  }

  return {
    name: restaurantName ?? reservation?.restaurantName ?? DEFAULT_VENUE.name,
    address: DEFAULT_VENUE.address,
    timezone: reservation?.restaurantTimezone ?? DEFAULT_VENUE.timezone,
    slug: reservation?.restaurantSlug ?? DEFAULT_VENUE.slug,
  };
}

export function buildBookingDto(
  reservation: Reservation | undefined,
  restaurantName: string | null,
  venue: ReservationVenue,
): BookingDTO | null {
  if (!reservation) return null;
  return {
    id: reservation.id,
    restaurantId: reservation.restaurantId,
    restaurantName: restaurantName ?? 'Reservation',
    restaurantSlug: reservation.restaurantSlug ?? venue.slug ?? DEFAULT_VENUE.slug,
    restaurantTimezone: venue.timezone,
    partySize: reservation.partySize,
    startIso: reservation.startAt,
    endIso: reservation.endAt ?? reservation.startAt,
    status: reservation.status as BookingDTO['status'],
    notes: reservation.notes ?? null,
  };
}

export function buildReservationSharePayload(params: {
  reservation: Reservation | undefined;
  reservationId: string;
  venue: ReservationVenue;
  manageUrl: string | null;
}): ReservationSharePayload | null {
  const { reservation, reservationId, venue, manageUrl } = params;
  if (!reservation) return null;

  return {
    reservationId,
    reference: reservation.reference ?? null,
    guestName: reservation.customerName,
    guestEmail: reservation.customerEmail,
    partySize: reservation.partySize,
    startAt: reservation.startAt,
    endAt: reservation.endAt ?? undefined,
    venueName: venue.name,
    venueAddress: venue.address,
    venueTimezone: venue.timezone,
    status: calendarStatusFromReservation(reservation.status),
    notes: reservation.notes,
    manageUrl,
  };
}

export function resolvePastGraceMs(rawValue: string | undefined): number {
  const parsed = rawValue ? Number(rawValue) : Number.NaN;
  const minutes = Number.isFinite(parsed) ? parsed : 5;
  return Math.max(0, minutes) * 60_000;
}

export function isPastReservation(params: {
  reservation: Reservation | undefined;
  venueTimezone: string;
  clockNow: number;
  pastGraceMs: number;
}): boolean {
  const { reservation, venueTimezone, clockNow, pastGraceMs } = params;
  if (!reservation?.startAt) return false;
  const startMs = getBookingDateTimeMillis(
    reservation.startAt,
    reservation.restaurantTimezone ?? venueTimezone,
  );
  if (startMs === null) return false;
  return startMs < clockNow - pastGraceMs;
}

export function resolvePendingLockState(params: {
  reservation: Reservation | undefined;
  clockNow: number;
}): PendingLockState {
  const { reservation, clockNow } = params;
  const pendingGraceMinutes = getPendingSelfServeGraceMinutes();

  if (!reservation || reservation.status !== 'pending') {
    return { locked: false, lockTimestamp: null };
  }

  const locked = isPendingSelfServeLocked(reservation.status, reservation.createdAt, clockNow);
  const createdMs = reservation.createdAt ? Date.parse(reservation.createdAt) : Number.NaN;
  const lockTimestamp = Number.isFinite(createdMs)
    ? createdMs + pendingGraceMinutes * 60_000
    : null;

  return { locked, lockTimestamp };
}

export function shouldDisableReservationActions(params: {
  reservation: Reservation | undefined;
  pendingLocked: boolean;
  isPastReservation: boolean;
  canManage: boolean;
}): boolean {
  const { reservation, pendingLocked, isPastReservation, canManage } = params;
  if (!reservation) return true;
  return reservation.status === 'cancelled' || pendingLocked || isPastReservation || !canManage;
}

export function buildRebookPath(params: {
  reservation: Pick<Reservation, 'id' | 'restaurantSlug'>;
  venueSlug?: string | null;
}): string {
  const { reservation, venueSlug } = params;
  const slug = [reservation.restaurantSlug, venueSlug]
    .map((value) => value?.trim())
    .find((value) => value && value.toLowerCase() !== 'default');
  const path = slug ? `/restaurants/${slug}/book` : '/restaurants';
  return `${path}?source=rebook&reservationId=${reservation.id}`;
}

export function resolveReservationStatusConfig(status: string): ReservationStatusConfig {
  const configs: Record<string, ReservationStatusConfig> = {
    confirmed: { label: 'Confirmed', tone: 'success', iconKey: 'confirmed' },
    cancelled: { label: 'Cancelled', tone: 'danger', iconKey: 'cancelled' },
    completed: { label: 'Completed', tone: 'default', iconKey: 'confirmed' },
    pending: { label: 'Pending Confirmation', tone: 'warning', iconKey: 'pending' },
    pending_allocation: { label: 'Confirming Table', tone: 'warning', iconKey: 'pending' },
    checked_in: { label: 'Checked In', tone: 'info', iconKey: 'checkedIn' },
  };
  return configs[status] ?? { label: status, tone: 'default', iconKey: 'default' };
}
