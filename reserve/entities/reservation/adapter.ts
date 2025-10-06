import { z } from 'zod';

import {
  reservationListSchema,
  reservationSchema,
  type ReservationMetadata,
} from './reservation.schema';

const apiReservationSchema = z
  .object({
    id: z.string(),
    restaurant_id: z.string(),
    booking_date: z.string(),
    start_time: z.string(),
    end_time: z.string().optional().nullable(),
    start_at: z.string().optional().nullable(),
    end_at: z.string().optional().nullable(),
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
    client_request_id: z.string().optional().nullable(),
    idempotency_key: z.string().optional().nullable(),
    pending_ref: z.string().optional().nullable(),
    details: z.unknown().optional(),
    created_at: z.string().optional().nullable(),
    updated_at: z.string().optional().nullable(),
    restaurants: z
      .union([
        z
          .object({
            name: z.string().optional().nullable(),
          })
          .passthrough(),
        z.array(
          z
            .object({
              name: z.string().optional().nullable(),
            })
            .passthrough(),
        ),
      ])
      .optional(),
  })
  .passthrough();

const apiReservationListSchema = z.array(apiReservationSchema);

const isRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const toIsoString = (date: string, time: string | null | undefined): string => {
  if (!time) {
    return new Date(date).toISOString();
  }

  // Combine date and time as UTC-safe ISO string. The server usually provides start_at/end_at,
  // but this acts as a fallback to avoid returning "Invalid Date".
  const isoCandidate = `${date}T${time.length === 5 ? `${time}:00` : time}`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(date).toISOString();
  }
  return parsed.toISOString();
};

const parseMetadata = (details: unknown): ReservationMetadata => {
  const record = isRecord(details);
  if (!record) {
    return null;
  }

  const requestRecord = isRecord(record.request);

  const metadata: ReservationMetadata = {
    channel: typeof record.channel === 'string' ? record.channel : null,
    request: requestRecord
      ? {
          idempotencyKey:
            typeof requestRecord.idempotency_key === 'string'
              ? requestRecord.idempotency_key
              : null,
          clientRequestId:
            typeof requestRecord.client_request_id === 'string'
              ? requestRecord.client_request_id
              : null,
          userAgent: typeof requestRecord.user_agent === 'string' ? requestRecord.user_agent : null,
        }
      : undefined,
  };

  const conflictRecord = isRecord(record.conflict);
  if (conflictRecord) {
    metadata.conflict = {
      reason: typeof conflictRecord.reason === 'string' ? conflictRecord.reason : null,
      detectedAt:
        typeof conflictRecord.detected_at === 'string' ? conflictRecord.detected_at : undefined,
      resolvedAt:
        typeof conflictRecord.resolved_at === 'string' ? conflictRecord.resolved_at : undefined,
    };
  }

  if (typeof record.rescheduled_from === 'string') {
    metadata.rescheduledFrom = record.rescheduled_from;
  }

  if (typeof record.rescheduled_at === 'string') {
    metadata.rescheduledAt = record.rescheduled_at;
  }

  return metadata;
};

const extractRestaurantName = (input: unknown): string | null => {
  if (!input) return null;
  if (Array.isArray(input)) {
    return extractRestaurantName(input[0]);
  }
  const record = isRecord(input);
  if (!record) return null;
  const { name } = record;
  return typeof name === 'string' ? name : null;
};

const normalizeReservation = (input: z.infer<typeof apiReservationSchema>) => {
  const metadata = parseMetadata(input.details);
  const startAt =
    typeof input.start_at === 'string' && input.start_at.length > 0
      ? input.start_at
      : toIsoString(input.booking_date, input.start_time);
  const endAtRaw =
    typeof input.end_at === 'string' && input.end_at.length > 0
      ? input.end_at
      : input.end_time
        ? toIsoString(input.booking_date, input.end_time)
        : null;

  return {
    id: input.id,
    restaurantId: input.restaurant_id,
    restaurantName: extractRestaurantName(input.restaurants),
    bookingDate: input.booking_date,
    startTime: input.start_time,
    endTime: input.end_time ?? undefined,
    startAt,
    endAt: endAtRaw,
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
    clientRequestId:
      typeof input.client_request_id === 'string' && input.client_request_id.length > 0
        ? input.client_request_id
        : null,
    idempotencyKey:
      typeof input.idempotency_key === 'string' && input.idempotency_key.length > 0
        ? input.idempotency_key
        : null,
    pendingRef:
      typeof input.pending_ref === 'string' && input.pending_ref.length > 0
        ? input.pending_ref
        : null,
    metadata,
    createdAt:
      typeof input.created_at === 'string' && input.created_at.length > 0 ? input.created_at : null,
    updatedAt:
      typeof input.updated_at === 'string' && input.updated_at.length > 0 ? input.updated_at : null,
  };
};

export function reservationAdapter(payload: unknown) {
  const parsed = apiReservationSchema.parse(payload);
  return reservationSchema.parse(normalizeReservation(parsed));
}

export function reservationListAdapter(payload: unknown) {
  const parsed = apiReservationListSchema.parse(payload);
  return reservationListSchema.parse(parsed.map(normalizeReservation));
}
