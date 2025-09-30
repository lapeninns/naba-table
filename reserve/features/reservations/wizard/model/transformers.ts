import { bookingHelpers } from '@reserve/shared/utils/booking';
import { DEFAULT_RESTAURANT_ID } from '@shared/config/venue';

import type { ApiBooking, BookingDetails, ReservationDraft } from './reducer';
import type { Reservation } from '@entities/reservation/reservation.schema';

type DraftSuccess = {
  ok: true;
  draft: ReservationDraft;
};

type DraftFailure = {
  ok: false;
  error: string;
};

type DraftResult = DraftSuccess | DraftFailure;

const buildMarketingOptIn = (marketingOptIn: boolean | undefined): boolean =>
  Boolean(marketingOptIn);

export const buildReservationDraft = (details: BookingDetails): DraftResult => {
  const normalizedTime = bookingHelpers.normalizeTime(details.time);

  if (!normalizedTime) {
    return { ok: false, error: 'Please select a time for your reservation.' };
  }

  const bookingType =
    details.bookingType === 'drinks'
      ? 'drinks'
      : bookingHelpers.bookingTypeFromTime(normalizedTime, details.date);

  return {
    ok: true,
    draft: {
      restaurantId: details.restaurantId || DEFAULT_RESTAURANT_ID,
      date: details.date,
      time: normalizedTime,
      party: Math.max(1, details.party),
      bookingType,
      seating: details.seating,
      notes: details.notes ? details.notes : null,
      name: details.name.trim(),
      email: details.email.trim(),
      phone: details.phone.trim(),
      marketingOptIn: buildMarketingOptIn(details.marketingOptIn),
    },
  };
};

export const reservationToApiBooking = (reservation: Reservation): ApiBooking => ({
  id: reservation.id,
  restaurant_id: reservation.restaurantId,
  customer_id: 'unknown',
  table_id: null,
  booking_date: reservation.bookingDate,
  start_time: reservation.startTime,
  end_time: reservation.endTime ?? reservation.startTime,
  reference: reservation.reference ?? '',
  party_size: reservation.partySize,
  booking_type: reservation.bookingType as ApiBooking['booking_type'],
  seating_preference: reservation.seatingPreference as ApiBooking['seating_preference'],
  status: reservation.status,
  customer_name: reservation.customerName,
  customer_email: reservation.customerEmail,
  customer_phone: reservation.customerPhone,
  notes: reservation.notes ?? null,
  source: 'app',
  marketing_opt_in: buildMarketingOptIn(reservation.marketingOptIn),
  loyalty_points_awarded: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
