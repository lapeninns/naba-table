'use client';

import { useCallback, useState } from 'react';

import { useOpsCancelBooking } from './useOpsCancelBooking';

import type { BookingDTO } from '@/hooks/useBookings';

type CancelTarget = Pick<BookingDTO, 'id' | 'customerName' | 'partySize'> & {
  restaurantId?: string | null;
};

/**
 * The single cancel flow for the ops dashboard and bookings list: which booking the confirm
 * dialog is for, the request, and the dialog's open/pending state.
 *
 * The dialog stays open with a pending state until the request settles. It closes on success and
 * stays open on failure (the error toast explains why), so the user can retry or keep the
 * booking. Closing is ignored while the request is in flight.
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
    if (outcome.status === 'done') {
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
