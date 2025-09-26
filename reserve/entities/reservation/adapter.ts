import { z } from 'zod';

import { reservationListSchema, reservationSchema } from './reservation.schema';

const apiReservationSchema = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  booking_date: z.string(),
  start_time: z.string(),
  end_time: z.string().optional().nullable(),
  booking_type: z.string(),
  seating_preference: z.string(),
  status: z.string(),
  party_size: z.number(),
  customer_name: z.string(),
  customer_email: z.string(),
  customer_phone: z.string(),
  marketing_opt_in: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  reference: z.string().optional(),
});

const apiReservationListSchema = z.array(apiReservationSchema);

const normalizeReservation = (input: z.infer<typeof apiReservationSchema>) => ({
  id: input.id,
  restaurantId: input.restaurant_id,
  bookingDate: input.booking_date,
  startTime: input.start_time,
  endTime: input.end_time ?? undefined,
  bookingType: input.booking_type as 'lunch' | 'dinner' | 'drinks',
  seatingPreference: input.seating_preference,
  status: input.status,
  partySize: input.party_size,
  customerName: input.customer_name,
  customerEmail: input.customer_email,
  customerPhone: input.customer_phone,
  marketingOptIn: Boolean(input.marketing_opt_in),
  notes: input.notes ?? null,
  reference: input.reference,
});

export function reservationAdapter(payload: unknown) {
  const parsed = apiReservationSchema.parse(payload);
  return reservationSchema.parse(normalizeReservation(parsed));
}

export function reservationListAdapter(payload: unknown) {
  const parsed = apiReservationListSchema.parse(payload);
  return reservationListSchema.parse(parsed.map(normalizeReservation));
}
