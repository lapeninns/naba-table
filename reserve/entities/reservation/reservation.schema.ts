import { z } from 'zod';

export const reservationSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  partySize: z.number().int().positive(),
  bookingType: z.enum(['lunch', 'dinner', 'drinks']),
  seatingPreference: z.string(),
  status: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string(),
  marketingOptIn: z.boolean(),
  notes: z.string().nullable(),
  reference: z.string().optional(),
});

export type Reservation = z.infer<typeof reservationSchema>;

export const reservationListSchema = z.array(reservationSchema);

export type ReservationList = z.infer<typeof reservationListSchema>;
