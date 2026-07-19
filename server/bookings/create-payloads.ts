import {
  buildBookingAuditSnapshot,
  logAuditEvent,
  updateBookingRecord,
  type BookingRecord,
} from '@/server/bookings';
import { normalizeEmail } from '@/server/customers';

import { DEFAULT_SEATING_PREFERENCE, type BookingCreateRequest } from './request-validation';

import type { BookingInput, ValidationContext } from '@/server/booking';
import type { CreateBookingParams } from '@/server/capacity';
import type { Json } from '@/types/supabase';

export type BookingCreateCustomer = {
  id: string;
};

export type BookingInitialStatusEnforcement = {
  bookingId: string;
  payload: {
    status: 'pending';
  };
};

export type BookingCreatePayloadBase = {
  request: BookingCreateRequest;
  customer: BookingCreateCustomer;
  restaurantId: string;
  bookingType: BookingCreateRequest['bookingType'];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  idempotencyKey: string | null;
  bookingSource: string;
  clientRequestId: string;
  bookingDetails: Json | null;
};

export function buildBookingValidationCreatePayload(
  params: BookingCreatePayloadBase & {
    scheduleTimezone: string | null;
    pastTimeBlocking: boolean;
    pastTimeGraceMinutes: number;
  },
): {
  input: BookingInput;
  context: ValidationContext;
} {
  const input: BookingInput = {
    restaurantId: params.restaurantId,
    serviceId: params.bookingType,
    bookingType: params.bookingType,
    partySize: params.request.party,
    start: `${params.request.date}T${params.startTime}:00`,
    durationMinutes: params.durationMinutes,
    notes: params.request.notes ?? null,
    customerId: params.customer.id,
    customerName: params.request.name,
    customerEmail: normalizeEmail(params.request.email),
    customerPhone: params.request.phone.trim(),
    marketingOptIn: params.request.marketingOptIn ?? false,
    source: params.bookingSource,
    idempotencyKey: params.idempotencyKey,
    details: params.bookingDetails,
  };

  const context: ValidationContext = {
    actorId: params.clientRequestId,
    actorRoles: ['customer'],
    actorCapabilities: [],
    tz: params.scheduleTimezone ?? 'Europe/London',
    flags: {
      bookingPastTimeBlocking: params.pastTimeBlocking,
      bookingPastTimeGraceMinutes: params.pastTimeGraceMinutes,
      unified: true,
    },
    metadata: {
      clientRequestId: params.clientRequestId,
    },
  };

  return { input, context };
}

export function buildCapacityCreateBookingParams(
  params: BookingCreatePayloadBase,
): CreateBookingParams {
  return {
    restaurantId: params.restaurantId,
    customerId: params.customer.id,
    bookingDate: params.request.date,
    startTime: params.startTime,
    endTime: params.endTime,
    partySize: params.request.party,
    bookingType: params.bookingType,
    customerName: params.request.name,
    customerEmail: normalizeEmail(params.request.email),
    customerPhone: params.request.phone.trim(),
    seatingPreference: DEFAULT_SEATING_PREFERENCE,
    notes: params.request.notes ?? null,
    marketingOptIn: params.request.marketingOptIn ?? false,
    idempotencyKey: params.idempotencyKey,
    source: params.bookingSource,
    authUserId: null,
    clientRequestId: params.clientRequestId,
    details: params.bookingDetails,
  };
}

export type FallbackInsertBookingPayload = {
  restaurant_id: string;
  customer_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  booking_type: BookingCreateRequest['bookingType'];
  seating_preference: typeof DEFAULT_SEATING_PREFERENCE;
  status: 'pending';
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  marketing_opt_in: boolean;
  loyalty_points_awarded: 0;
  source: 'api';
  client_request_id: string;
  idempotency_key: string | null;
  details: Json;
};

export function buildFallbackInsertBookingPayload(
  params: BookingCreatePayloadBase & { reference: string },
): FallbackInsertBookingPayload {
  return {
    restaurant_id: params.restaurantId,
    customer_id: params.customer.id,
    booking_date: params.request.date,
    start_time: params.startTime,
    end_time: params.endTime,
    party_size: params.request.party,
    booking_type: params.bookingType,
    seating_preference: DEFAULT_SEATING_PREFERENCE,
    status: 'pending',
    reference: params.reference,
    customer_name: params.request.name,
    customer_email: normalizeEmail(params.request.email),
    customer_phone: params.request.phone.trim(),
    notes: params.request.notes ?? null,
    marketing_opt_in: params.request.marketingOptIn ?? false,
    loyalty_points_awarded: 0,
    source: 'api',
    client_request_id: params.clientRequestId,
    idempotency_key: params.idempotencyKey ?? null,
    details: { fallback: 'missing_rpc_booking_record' },
  };
}

export function buildBookingCreatedAuditMetadata(params: {
  restaurantId: string;
  customer: BookingCreateCustomer;
  booking: BookingRecord;
}): Json {
  return {
    restaurant_id: params.restaurantId,
    customer_id: params.customer.id,
    reference: params.booking.reference,
    ...buildBookingAuditSnapshot(null, params.booking),
  } satisfies Json;
}

export type BookingCreatedAuditEvent = {
  action: 'booking.created';
  entity: 'booking';
  entityId: string;
  metadata: Json;
  actor: string;
};

export function buildBookingCreatedAuditEvent(params: {
  restaurantId: string;
  customer: BookingCreateCustomer;
  booking: BookingRecord;
  actor: string;
}): BookingCreatedAuditEvent {
  return {
    action: 'booking.created',
    entity: 'booking',
    entityId: params.booking.id,
    metadata: buildBookingCreatedAuditMetadata({
      restaurantId: params.restaurantId,
      customer: params.customer,
      booking: params.booking,
    }),
    actor: params.actor,
  };
}

export type BookingCreatedAuditLogger = (
  client: Parameters<typeof logAuditEvent>[0],
  event: BookingCreatedAuditEvent,
) => Promise<void>;

export async function dispatchBookingCreatedAuditEvent({
  actor,
  booking,
  client,
  customer,
  logger = logAuditEvent,
  restaurantId,
}: {
  actor: string;
  booking: BookingRecord;
  client: Parameters<typeof logAuditEvent>[0];
  customer: BookingCreateCustomer;
  logger?: BookingCreatedAuditLogger;
  restaurantId: string;
}): Promise<void> {
  await logger(
    client,
    buildBookingCreatedAuditEvent({
      restaurantId,
      customer,
      booking,
      actor,
    }),
  );
}

export function buildBookingInitialStatusEnforcement({
  booking,
  reusedExisting,
}: {
  booking: BookingRecord;
  reusedExisting: boolean;
}): BookingInitialStatusEnforcement | null {
  if (reusedExisting || booking.status === 'pending') {
    return null;
  }

  return {
    bookingId: booking.id,
    payload: { status: 'pending' },
  };
}

export type BookingInitialStatusUpdater = (
  client: Parameters<typeof updateBookingRecord>[0],
  bookingId: string,
  payload: BookingInitialStatusEnforcement['payload'],
) => Promise<BookingRecord>;

export async function enforceBookingCreateInitialStatus({
  booking,
  client,
  onError,
  reusedExisting,
  updater = updateBookingRecord,
}: {
  booking: BookingRecord;
  client: Parameters<typeof updateBookingRecord>[0];
  onError?: (error: unknown) => void;
  reusedExisting: boolean;
  updater?: BookingInitialStatusUpdater;
}): Promise<BookingRecord> {
  const statusEnforcement = buildBookingInitialStatusEnforcement({
    booking,
    reusedExisting,
  });

  if (!statusEnforcement) {
    return booking;
  }

  try {
    return await updater(client, statusEnforcement.bookingId, statusEnforcement.payload);
  } catch (error) {
    onError?.(error);
    return booking;
  }
}
