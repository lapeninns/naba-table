import type { Reservation } from '@entities/reservation/reservation.schema';

export type ReservationSubmissionResult = {
  booking: Reservation | null;
  bookings: Reservation[];
};
