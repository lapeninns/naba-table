import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/supabase";

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
  waitlisted: boolean;
  loyaltyPointsAwarded?: number;
};

type BookingCancelledPayload = BaseEventPayload & {
  previousStatus: Tables<"bookings">["status"];
  cancelledBy: "customer" | "staff" | "system";
};

type BookingAllocatedPayload = BaseEventPayload & {
  tableId: string;
  allocationStatus: "allocated" | "reallocated";
};

type BookingWaitlistedPayload = BaseEventPayload & {
  waitlistId: string;
  position: number;
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
      waitlisted: payload.waitlisted,
      loyalty_points_awarded: payload.loyaltyPointsAwarded ?? 0,
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

export async function recordBookingAllocatedEvent(
  client: DbClient,
  payload: BookingAllocatedPayload,
): Promise<void> {
  await insertAnalyticsEvent(client, {
    eventType: "booking.allocated",
    bookingId: payload.bookingId,
    restaurantId: payload.restaurantId,
    customerId: payload.customerId ?? null,
    occurredAt: payload.occurredAt,
    payload: {
      booking_id: payload.bookingId,
      restaurant_id: payload.restaurantId,
      customer_id: payload.customerId ?? null,
      table_id: payload.tableId,
      allocation_status: payload.allocationStatus,
    },
  });
}

export async function recordBookingWaitlistedEvent(
  client: DbClient,
  payload: BookingWaitlistedPayload,
): Promise<void> {
  await insertAnalyticsEvent(client, {
    eventType: "booking.waitlisted",
    bookingId: payload.bookingId,
    restaurantId: payload.restaurantId,
    customerId: payload.customerId ?? null,
    occurredAt: payload.occurredAt,
    payload: {
      booking_id: payload.bookingId,
      restaurant_id: payload.restaurantId,
      customer_id: payload.customerId ?? null,
      waitlist_id: payload.waitlistId,
      position: payload.position,
    },
  });
}
