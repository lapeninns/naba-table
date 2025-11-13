import { normalizeTime } from '@reserve/shared/time';

import type { FetchBookingsByContactParams } from '../api/fetchBookingsByContact';
import type { ReservationDraft } from '../model/reducer';
import type { Reservation } from '@entities/reservation/reservation.schema';

type FetchBookingsFn = (params: FetchBookingsByContactParams) => Promise<Reservation[]>;

export type TimeoutRecoveryResult = {
  booking: Reservation;
  bookings: Reservation[];
};

export type TimeoutRecoveryParams = {
  draft: ReservationDraft;
  fetchBookings: FetchBookingsFn;
  attempts?: number;
  delayMs?: number;
  logger?: (error: unknown) => void;
};

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 2_000;
const RECENT_WINDOW_MS = 10 * 60 * 1_000;

export async function recoverBookingAfterTimeout(
  params: TimeoutRecoveryParams,
): Promise<TimeoutRecoveryResult | null> {
  const { draft, fetchBookings, logger } = params;
  const attempts = Math.max(1, params.attempts ?? DEFAULT_ATTEMPTS);
  const delayMs = Math.max(0, params.delayMs ?? DEFAULT_DELAY_MS);

  if (!draft?.restaurantId || !draft.email || !draft.phone) {
    return null;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let bookings: Reservation[];
    try {
      bookings = await fetchBookings({
        restaurantId: draft.restaurantId,
        email: draft.email,
        phone: draft.phone,
      });
    } catch (error) {
      logger?.(error);
      break;
    }

    const match = findMatchingReservation(bookings, draft);
    if (match) {
      return { booking: match, bookings };
    }

    if (attempt < attempts - 1 && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return null;
}

export function findMatchingReservation(
  bookings: Reservation[],
  draft: ReservationDraft,
): Reservation | null {
  if (!draft?.restaurantId || !draft.email || !draft.phone) {
    return null;
  }

  const normalizedTime = normalizeTime(draft.time);
  const normalizedEmail = draft.email.trim().toLowerCase();
  const normalizedPhone = normalizePhone(draft.phone);

  return (
    bookings.find((booking) => {
      if (!booking) {
        return false;
      }

      if (booking.restaurantId !== draft.restaurantId) {
        return false;
      }

      if (booking.bookingDate !== draft.date) {
        return false;
      }

      if (booking.partySize !== draft.party) {
        return false;
      }

      if (booking.status?.toLowerCase() === 'cancelled') {
        return false;
      }

      const bookingTime = normalizeTime(booking.startTime);
      if (normalizedTime && bookingTime !== normalizedTime) {
        return false;
      }

      if (booking.customerEmail.trim().toLowerCase() !== normalizedEmail) {
        return false;
      }

      if (normalizePhone(booking.customerPhone) !== normalizedPhone) {
        return false;
      }

      if (!isRecent(booking.createdAt)) {
        return false;
      }

      return true;
    }) ?? null
  );
}

function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function isRecent(createdAt?: string | null): boolean {
  if (!createdAt) {
    return true;
  }
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }
  return Date.now() - timestamp <= RECENT_WINDOW_MS;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
