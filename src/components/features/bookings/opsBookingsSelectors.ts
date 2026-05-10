import {
  buildOpsBookingCardViewModel,
  type OpsBookingCardViewModel,
} from '@/components/features/dashboard/cards/opsBookingCardUtils';
import { mapOpsBookingListItemToBookingDTO } from '@/utils/ops/mapOpsBookingListItemToBookingDTO';

import type { BookingAction } from '@/components/features/booking-state-machine';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingListItem, OpsBookingStatus } from '@/types/ops';

export type OpsBookingsDerivedData = {
  bookings: BookingDTO[];
  bookingById: Map<string, BookingDTO>;
  bookingLabelsById: Map<string, string>;
  initialSnapshots: { id: string; status: OpsBookingStatus; updatedAt: null }[];
};

export function deriveOpsBookingsData(
  items: OpsBookingListItem[],
  fallbackRestaurantSlug: string | null,
): OpsBookingsDerivedData {
  const bookings: BookingDTO[] = [];
  const bookingById = new Map<string, BookingDTO>();
  const bookingLabelsById = new Map<string, string>();
  const initialSnapshots: { id: string; status: OpsBookingStatus; updatedAt: null }[] = [];

  for (const item of items) {
    const booking = mapOpsBookingListItemToBookingDTO(item, fallbackRestaurantSlug);
    bookings.push(booking);
    bookingById.set(booking.id, booking);

    const label = booking.customerName?.trim();
    if (label) {
      bookingLabelsById.set(booking.id, label);
    }

    initialSnapshots.push({
      id: booking.id,
      status: booking.status as OpsBookingStatus,
      updatedAt: null,
    });
  }

  return {
    bookings,
    bookingById,
    bookingLabelsById,
    initialSnapshots,
  };
}

export function buildOpsBookingsCardRows(params: {
  bookings: BookingDTO[];
  timezone: string;
  now: Date;
  pendingActionsByBookingId?: Record<string, BookingAction | null>;
}): OpsBookingCardViewModel[] {
  const { bookings, timezone, now, pendingActionsByBookingId } = params;

  return bookings.map((booking) => {
    const pendingAction = pendingActionsByBookingId?.[booking.id] ?? null;
    return buildOpsBookingCardViewModel({
      booking,
      timezone,
      now,
      pendingAction,
      actionsDisabled: pendingAction !== null,
    });
  });
}
