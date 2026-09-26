'use client';

import { useCallback, useState } from 'react';

import { HttpError } from '@/lib/http/errors';

import { useOpsCancelBooking, type CancelBookingOutcome } from './useOpsCancelBooking';

import type { BookingDTO } from '@/hooks/useBookings';

/** Failures a retry cannot fix: the booking's state changed, so the dialog closes. */
const TERMINAL_CANCEL_CODES: ReadonlySet<string> = new Set([
  'BOOKING_NOT_CANCELLABLE',
  'BOOKING_NOT_FOUND',
  'BOOKING_STATE_CONFLICT',
  'CUTOFF_PASSED',
]);

export function isTerminalCancelError(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  return TERMINAL_CANCEL_CODES.has(error.code) || error.retryable === false;
}

/**
 * Whether a cancel confirmation should close after this outcome: on success, and on failures a
 * retry cannot fix. Shared by the dashboard/list flow and the booking-details dialog.
 */
export function shouldCloseCancelConfirmation(outcome: CancelBookingOutcome): boolean {
  return outcome.status === 'done' || isTerminalCancelError(outcome.error);
}

type CancelTarget = Pick<BookingDTO, 'id' | 'customerName' | 'partySize'> & {
  restaurantId?: string | null;
};

/**
 * The single cancel flow for the ops dashboard and bookings list: which booking the confirm
 * dialog is for, the request, and the dialog's open/pending state.
 *
 * The dialog stays open with a pending state until the request settles. It closes on success,
 * and on failures a retry cannot fix (the booking is no longer cancellable, gone, or changed
 * elsewhere; the error toast explains why). It stays open on other failures (network, 5xx) so
 * the user can retry or keep the booking. Closing is ignored while the request is in flight.
 */
export function useOpsCancelBookingController<TBooking extends CancelTarget>(params: {
  /** Used when the booking row has no restaurant id. */
  fallbackRestaurantId: string | null;
}) {
  const { fallbackRestaurantId } = params;
  const { cancel, isPending } = useOpsCancelBooking();
  const [booking, setBooking] = useState<TBooking | null>(null);
  const pending = isPending(booking?.id);

  const request = useCallback((target: TBooking) => {
    setBooking(target);
  }, []);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open || pending) return;
      setBooking(null);
    },
    [pending],
  );

  const confirm = useCallback(async () => {
    if (!booking) return;
    const restaurantId = booking.restaurantId ?? fallbackRestaurantId;
    if (!restaurantId) return;
    const outcome = await cancel({ bookingId: booking.id, restaurantId });
    if (shouldCloseCancelConfirmation(outcome)) {
      setBooking((current) => (current?.id === booking.id ? null : current));
    }
  }, [booking, cancel, fallbackRestaurantId]);

  return {
    booking,
    isOpen: booking !== null,
    isPending: pending,
    request,
    onOpenChange,
    confirm,
  };
}

export type OpsCancelBookingController<TBooking extends CancelTarget = BookingDTO> = ReturnType<
  typeof useOpsCancelBookingController<TBooking>
>;
