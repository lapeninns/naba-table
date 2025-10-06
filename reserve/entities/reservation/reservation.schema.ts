import { z } from 'zod';

const reservationMetadataSchema = z
  .object({
    channel: z.string().nullable().optional(),
    allocationPending: z.boolean().optional(),
    request: z
      .object({
        idempotencyKey: z.string().nullable().optional(),
        clientRequestId: z.string().nullable().optional(),
        userAgent: z.string().nullable().optional(),
      })
      .optional(),
    conflict: z
      .object({
        reason: z.string().nullable().optional(),
        detectedAt: z.string().datetime({ offset: true }).nullable().optional(),
        resolvedAt: z.string().datetime({ offset: true }).nullable().optional(),
      })
      .optional(),
    rescheduledFrom: z.string().datetime({ offset: true }).nullable().optional(),
    rescheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .partial()
  .nullable();

export const reservationSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  restaurantName: z.string().nullable().optional(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), // Allow HH:MM or HH:MM:SS
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/) // Allow HH:MM or HH:MM:SS
    .optional(),
  startAt: z.string().datetime({ offset: true }), // Allow both Z and offset formats
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
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
  allocationPending: z.boolean(),
  clientRequestId: z.string().uuid().nullable(),
  idempotencyKey: z.string().nullable(),
  pendingRef: z.string().nullable(),
  metadata: reservationMetadataSchema,
  createdAt: z.string().datetime({ offset: true }).nullable().optional(),
  updatedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type ReservationMetadata = z.infer<typeof reservationMetadataSchema>;
export type Reservation = z.infer<typeof reservationSchema>;

export const reservationListSchema = z.array(reservationSchema);

export type ReservationList = z.infer<typeof reservationListSchema>;
