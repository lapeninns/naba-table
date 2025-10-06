import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  recordBookingAllocatedEvent,
  recordBookingCancelledEvent,
  recordBookingCreatedEvent,
  recordBookingWaitlistedEvent,
} from "@/server/analytics";
import type { BookingRecord } from "@/server/bookings";
import { sendBookingCancellationEmail, sendBookingConfirmationEmail, sendBookingUpdateEmail } from "@/server/emails/bookings";
import { inngest, isAsyncQueueEnabled } from "@/server/queue/inngest";
import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";
import type { Tables } from "@/types/supabase";

export const BOOKING_CREATED_EVENT = "sajiloreservex/booking.created.side-effects" as const;
export const BOOKING_UPDATED_EVENT = "sajiloreservex/booking.updated.side-effects" as const;
export const BOOKING_CANCELLED_EVENT = "sajiloreservex/booking.cancelled.side-effects" as const;

const bookingPayloadSchema = z
  .object({
    id: z.string(),
    restaurant_id: z.string().nullable(),
    customer_id: z.string(),
    table_id: z.string().nullable(),
    booking_date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    booking_type: z.string(),
    seating_preference: z.string(),
    status: z.string(),
    party_size: z.number(),
    customer_name: z.string(),
    customer_email: z.string(),
    customer_phone: z.string().nullable(),
    notes: z.string().nullable(),
    source: z.string().nullable().optional(),
    loyalty_points_awarded: z.number().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    reference: z.string(),
    client_request_id: z.string().nullable().optional(),
    idempotency_key: z.string().nullable().optional(),
    pending_ref: z.string().nullable().optional(),
  })
  .passthrough();

type BookingPayload = z.infer<typeof bookingPayloadSchema>;

const waitlistEntrySchema = z
  .object({
    id: z.string(),
    position: z.number().int().min(0),
  })
  .nullable();

const bookingCreatedSideEffectsSchema = z.object({
  booking: bookingPayloadSchema,
  waitlisted: z.boolean(),
  allocationPending: z.boolean(),
  waitlistEntry: waitlistEntrySchema,
  idempotencyKey: z.string().nullable(),
  restaurantId: z.string(),
});

const bookingUpdatedSideEffectsSchema = z.object({
  previous: bookingPayloadSchema,
  current: bookingPayloadSchema,
  restaurantId: z.string(),
});

const bookingCancelledSideEffectsSchema = z.object({
  previous: bookingPayloadSchema,
  cancelled: bookingPayloadSchema,
  restaurantId: z.string(),
  cancelledBy: z.enum(["customer", "staff", "system"]),
});

export type BookingCreatedSideEffectsPayload = z.infer<typeof bookingCreatedSideEffectsSchema>;
export type BookingUpdatedSideEffectsPayload = z.infer<typeof bookingUpdatedSideEffectsSchema>;
export type BookingCancelledSideEffectsPayload = z.infer<typeof bookingCancelledSideEffectsSchema>;

type SupabaseLike = SupabaseClient<any, any, any>;

function serializePayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

function resolveSupabase(client?: SupabaseLike): SupabaseLike {
  return client ?? getServiceSupabaseClient();
}

function safeBookingPayload(record: BookingRecord): BookingPayload {
  return bookingPayloadSchema.parse(record);
}

async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  supabase?: SupabaseLike,
) {
  const client = resolveSupabase(supabase);
  const { booking, waitlisted, allocationPending, waitlistEntry, idempotencyKey, restaurantId } = payload;

  try {
    await recordBookingCreatedEvent(client, {
      bookingId: booking.id,
      restaurantId,
      customerId: booking.customer_id,
      status: booking.status as Tables<"bookings">["status"],
      partySize: booking.party_size,
      bookingType: booking.booking_type as Tables<"bookings">["booking_type"],
      seatingPreference: booking.seating_preference as Tables<"bookings">["seating_preference"],
      source: booking.source ?? "api",
      waitlisted,
      loyaltyPointsAwarded: booking.loyalty_points_awarded ?? 0,
      occurredAt: booking.created_at,
      clientRequestId: booking.client_request_id ?? undefined,
      idempotencyKey,
      pendingRef: booking.pending_ref ?? undefined,
    });

    if (waitlistEntry) {
      await recordBookingWaitlistedEvent(client, {
        bookingId: booking.id,
        restaurantId,
        customerId: booking.customer_id,
        waitlistId: waitlistEntry.id,
        position: waitlistEntry.position,
        occurredAt: booking.created_at,
      });
    } else if (!allocationPending && booking.table_id) {
      await recordBookingAllocatedEvent(client, {
        bookingId: booking.id,
        restaurantId,
        customerId: booking.customer_id,
        tableId: booking.table_id,
        allocationStatus: "allocated",
        occurredAt: booking.updated_at,
      });
    }
  } catch (error) {
    console.error("[jobs][booking.created][analytics]", error);
    void recordObservabilityEvent({
      source: "jobs.booking",
      eventType: "analytics.emit.failed",
      severity: "warning",
      context: {
        bookingId: booking.id,
        event: "booking.created",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  if (booking.status !== "pending_allocation") {
    try {
      await sendBookingConfirmationEmail(booking as BookingRecord);
    } catch (error) {
      console.error("[jobs][booking.created][email]", error);
    }
  }
}

async function processBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  supabase?: SupabaseLike,
) {
  const client = resolveSupabase(supabase);
  const { previous, current, restaurantId } = payload;

  if (current.table_id) {
    const allocationStatus = previous.table_id && previous.table_id !== current.table_id ? "reallocated" : "allocated";

    try {
      await recordBookingAllocatedEvent(client, {
        bookingId: current.id,
        restaurantId,
        customerId: current.customer_id,
        tableId: current.table_id,
        allocationStatus,
        occurredAt: current.updated_at,
      });
    } catch (error) {
      console.error("[jobs][booking.updated][analytics]", error);
    }
  }

  try {
    await sendBookingUpdateEmail(current as BookingRecord);
  } catch (error) {
    console.error("[jobs][booking.updated][email]", error);
  }
}

async function processBookingCancelledSideEffects(
  payload: BookingCancelledSideEffectsPayload,
  supabase?: SupabaseLike,
) {
  const client = resolveSupabase(supabase);
  const { previous, cancelled, cancelledBy, restaurantId } = payload;

  try {
    await recordBookingCancelledEvent(client, {
      bookingId: cancelled.id,
      restaurantId,
      customerId: cancelled.customer_id,
      previousStatus: previous.status as Tables<"bookings">["status"],
      cancelledBy,
      occurredAt: cancelled.updated_at,
    });
  } catch (error) {
    console.error("[jobs][booking.cancelled][analytics]", error);
  }

  try {
    await sendBookingCancellationEmail(cancelled as BookingRecord);
  } catch (error) {
    console.error("[jobs][booking.cancelled][email]", error);
  }
}

export async function enqueueBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  if (!isAsyncQueueEnabled()) {
    await processBookingCreatedSideEffects(payload, options?.supabase);
    return { queued: false } as const;
  }

  try {
    await inngest.send({
      name: BOOKING_CREATED_EVENT,
      data: serializePayload(payload),
      id: `booking.created:${payload.booking.id}:${payload.booking.updated_at}`,
    });
    return { queued: true } as const;
  } catch (error) {
    console.error("[jobs][booking.created][enqueue]", error);
    await processBookingCreatedSideEffects(payload, options?.supabase);
    return { queued: false, fallback: true } as const;
  }
}

export async function enqueueBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  if (!isAsyncQueueEnabled()) {
    await processBookingUpdatedSideEffects(payload, options?.supabase);
    return { queued: false } as const;
  }

  try {
    await inngest.send({
      name: BOOKING_UPDATED_EVENT,
      data: serializePayload(payload),
      id: `booking.updated:${payload.current.id}:${payload.current.updated_at}`,
    });
    return { queued: true } as const;
  } catch (error) {
    console.error("[jobs][booking.updated][enqueue]", error);
    await processBookingUpdatedSideEffects(payload, options?.supabase);
    return { queued: false, fallback: true } as const;
  }
}

export async function enqueueBookingCancelledSideEffects(
  payload: BookingCancelledSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  if (!isAsyncQueueEnabled()) {
    await processBookingCancelledSideEffects(payload, options?.supabase);
    return { queued: false } as const;
  }

  try {
    await inngest.send({
      name: BOOKING_CANCELLED_EVENT,
      data: serializePayload(payload),
      id: `booking.cancelled:${payload.cancelled.id}:${payload.cancelled.updated_at}`,
    });
    return { queued: true } as const;
  } catch (error) {
    console.error("[jobs][booking.cancelled][enqueue]", error);
    await processBookingCancelledSideEffects(payload, options?.supabase);
    return { queued: false, fallback: true } as const;
  }
}

export const bookingCreatedSideEffectsFunction = inngest.createFunction(
  { id: "booking-created-side-effects" },
  { event: BOOKING_CREATED_EVENT },
  async ({ event }) => {
    const payload = bookingCreatedSideEffectsSchema.parse(event.data);
    await processBookingCreatedSideEffects(payload);
    return { success: true } as const;
  },
);

export const bookingUpdatedSideEffectsFunction = inngest.createFunction(
  { id: "booking-updated-side-effects" },
  { event: BOOKING_UPDATED_EVENT },
  async ({ event }) => {
    const payload = bookingUpdatedSideEffectsSchema.parse(event.data);
    await processBookingUpdatedSideEffects(payload);
    return { success: true } as const;
  },
);

export const bookingCancelledSideEffectsFunction = inngest.createFunction(
  { id: "booking-cancelled-side-effects" },
  { event: BOOKING_CANCELLED_EVENT },
  async ({ event }) => {
    const payload = bookingCancelledSideEffectsSchema.parse(event.data);
    await processBookingCancelledSideEffects(payload);
    return { success: true } as const;
  },
);

export const bookingSideEffectFunctions = [
  bookingCreatedSideEffectsFunction,
  bookingUpdatedSideEffectsFunction,
  bookingCancelledSideEffectsFunction,
];

export {
  processBookingCreatedSideEffects,
  processBookingUpdatedSideEffects,
  processBookingCancelledSideEffects,
  safeBookingPayload,
};
