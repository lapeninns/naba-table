import type { BookingRecord } from '@/server/bookings';

export type GuestBookingSource = Partial<BookingRecord> & { id: string };

export function toGuestBookingDTO(
  booking: GuestBookingSource,
  options: { restaurantName?: string | null } = {},
) {
  return {
    id: booking.id,
    restaurant_id: booking.restaurant_id ?? '',
    booking_date: booking.booking_date ?? '',
    start_time: booking.start_time ?? '',
    end_time: booking.end_time ?? null,
    start_at: booking.start_at ?? null,
    end_at: booking.end_at ?? null,
    reference: booking.reference ?? null,
    party_size: booking.party_size ?? 0,
    booking_type: booking.booking_type ?? 'dinner',
    seating_preference: booking.seating_preference ?? null,
    status: booking.status ?? 'pending',
    customer_name: booking.customer_name ?? '',
    customer_email: booking.customer_email ?? '',
    customer_phone: booking.customer_phone ?? '',
    notes: null,
    created_at: booking.created_at ?? null,
    updated_at: booking.updated_at ?? null,
    restaurants: {
      name: options.restaurantName ?? null,
      slug: null,
      timezone: null,
    },
  };
}
