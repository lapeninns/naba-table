import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


export const ANALYTICS_SCHEMA_VERSION = 1;

type DbClient = SupabaseClient<Database, any, any>;

type BaseEventPayload = {
  bookingId: string;
  restaurantId: string;
  customerId?: string | null;
  occurredAt?: string;
};

type BookingCreatedPayload = BaseEventPayload & {
  status: Tables<"bookings">["status"];
  partySize: number;
  bookingType: Tables<"bookings">["booking_type"];
  seatingPreference: Tables<"bookings">["seating_preference"];
  source: string;
  loyaltyPointsAwarded?: number;
  clientRequestId?: string;
  idempotencyKey?: string | null;
  pendingRef?: string;
};

type BookingCancelledPayload = BaseEventPayload & {
  previousStatus: Tables<"bookings">["status"];
  cancelledBy: "customer" | "staff" | "system";
};

async function insertAnalyticsEvent(
  client: DbClient,
  params: {
    eventType: Database["public"]["Enums"]["analytics_event_type"];
    payload: Record<string, unknown>;
    restaurantId: string;
    bookingId: string;
    customerId?: string | null;
    occurredAt?: string;
    emittedBy?: string;
  },
): Promise<void> {
  const occurredAt = params.occurredAt ?? new Date().toISOString();
  const payloadWithVersion = {
    ...params.payload,
    version: ANALYTICS_SCHEMA_VERSION,
  };

  const { error } = await client.from("analytics_events").insert({
    event_type: params.eventType,
    schema_version: ANALYTICS_SCHEMA_VERSION,
    restaurant_id: params.restaurantId,
    booking_id: params.bookingId,
    customer_id: params.customerId ?? null,
    emitted_by: params.emittedBy ?? "server",
    payload: payloadWithVersion,
    occurred_at: occurredAt,
  });

  if (error) {
    throw error;
  }
}

export async function recordBookingCreatedEvent(
  client: DbClient,
  payload: BookingCreatedPayload,
): Promise<void> {
  await insertAnalyticsEvent(client, {
    eventType: "booking.created",
    bookingId: payload.bookingId,
    restaurantId: payload.restaurantId,
    customerId: payload.customerId ?? null,
    occurredAt: payload.occurredAt,
    payload: {
      booking_id: payload.bookingId,
      restaurant_id: payload.restaurantId,
      customer_id: payload.customerId ?? null,
      status: payload.status,
      party_size: payload.partySize,
      booking_type: payload.bookingType,
      seating_preference: payload.seatingPreference,
      source: payload.source,
      loyalty_points_awarded: payload.loyaltyPointsAwarded ?? 0,
      client_request_id: payload.clientRequestId ?? null,
      idempotency_key: payload.idempotencyKey ?? null,
      pending_ref: payload.pendingRef ?? null,
    },
  });
}

export async function recordBookingCancelledEvent(
  client: DbClient,
  payload: BookingCancelledPayload,
): Promise<void> {
  await insertAnalyticsEvent(client, {
    eventType: "booking.cancelled",
    bookingId: payload.bookingId,
    restaurantId: payload.restaurantId,
    customerId: payload.customerId ?? null,
    occurredAt: payload.occurredAt,
    payload: {
      booking_id: payload.bookingId,
      restaurant_id: payload.restaurantId,
      customer_id: payload.customerId ?? null,
      previous_status: payload.previousStatus,
      cancelled_by: payload.cancelledBy,
    },
  });
}
