import { reservationListAdapter } from '@entities/reservation/adapter';
import { apiClient } from '@shared/api/client';

import type { Reservation } from '@entities/reservation/reservation.schema';

type FetchBookingsByContactParams = {
  restaurantId: string;
  email: string;
  phone: string;
};

export async function fetchBookingsByContact(
  params: FetchBookingsByContactParams,
): Promise<Reservation[]> {
  const { restaurantId, email, phone } = params;
  const search = new URLSearchParams({ email, phone });
  if (restaurantId?.length) {
    search.set('restaurantId', restaurantId);
  }

  const response = await apiClient.get<{ bookings?: unknown }>(`/bookings?${search.toString()}`);
  const rawBookings = Array.isArray(response?.bookings) ? response.bookings : [];
  return reservationListAdapter(rawBookings);
}

export type { FetchBookingsByContactParams };
