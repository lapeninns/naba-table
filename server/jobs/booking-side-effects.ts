import { z } from "zod";


import { recordBookingCancelledEvent, recordBookingCreatedEvent } from "@/server/analytics";
import { sendBookingCancellationEmail, sendBookingConfirmationEmail, sendBookingUpdateEmail } from "@/server/emails/bookings";
import { isAutoAssignOnBookingEnabled } from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingRecord } from "@/server/bookings";
import type { Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BOOKING_CREATED_EVENT = "sajiloreservex/booking.created.side-effects" as const;
export const BOOKING_UPDATED_EVENT = "sajiloreservex/booking.updated.side-effects" as const;
export const BOOKING_CANCELLED_EVENT = "sajiloreservex/booking.cancelled.side-effects" as const;

const bookingPayloadSchema = z
  .object({
    id: z.string(),
    restaurant_id: z.string().nullable(),
    customer_id: z.string(),
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

export type BookingCreatedSideEffectsPayload = {
  booking: BookingPayload;
  idempotencyKey: string | null;
  restaurantId: string;
};

export type BookingUpdatedSideEffectsPayload = {
  previous: BookingPayload;
  current: BookingPayload;
  restaurantId: string;
};

export type BookingCancelledSideEffectsPayload = {
  previous: BookingPayload;
  cancelled: BookingPayload;
  restaurantId: string;
  cancelledBy: "customer" | "staff" | "system";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = SupabaseClient<any, any, any>;

function resolveSupabase(client?: SupabaseLike): SupabaseLike {
  return client ?? getServiceSupabaseClient();
}

function safeBookingPayload(record: BookingRecord): BookingPayload {
  return bookingPayloadSchema.parse(record);
}

// Allow bypassing all outbound guest emails during load tests or local stress runs.
// Set LOAD_TEST_DISABLE_EMAILS=true to suppress email sending without changing business logic.
const SUPPRESS_EMAILS = process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';

async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  _supabase?: SupabaseLike,
) {
  const client = resolveSupabase(_supabase);
  const { booking, idempotencyKey, restaurantId } = payload;

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
      loyaltyPointsAwarded: booking.loyalty_points_awarded ?? 0,
      occurredAt: booking.created_at,
      clientRequestId: booking.client_request_id ?? undefined,
      idempotencyKey,
      pendingRef: booking.pending_ref ?? undefined,
    });
  } catch (error) {
    console.error("[jobs][booking.created][analytics]", error);
  }

  if (!SUPPRESS_EMAILS && booking.customer_email && booking.customer_email.trim().length > 0) {
    // If auto-assign is enabled AND we plan to retry in background, suppress the
    // initial "request received" email for pending bookings. Otherwise, send it
    // so guests aren't left without any acknowledgement when retries are disabled.
    const willRetryInBackground = isAutoAssignOnBookingEnabled() && (
      (process.env.FEATURE_AUTO_ASSIGN_MAX_RETRIES && Number(process.env.FEATURE_AUTO_ASSIGN_MAX_RETRIES) > 0)
    );
    const suppressCreatedEmail = willRetryInBackground &&
      (booking.status === "pending" || booking.status === "pending_allocation");

    if (!suppressCreatedEmail) {
      try {
        await sendBookingConfirmationEmail(booking as BookingRecord);
      } catch (error) {
        console.error("[jobs][booking.created][email]", error);
      }
    }
  }
}

async function processBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  _supabase?: SupabaseLike,
) {
  const { current } = payload;
  if (!SUPPRESS_EMAILS && current.customer_email && current.customer_email.trim().length > 0) {
    try {
      await sendBookingUpdateEmail(current as BookingRecord);
    } catch (error) {
      console.error("[jobs][booking.updated][email]", error);
    }
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

  if (!SUPPRESS_EMAILS && cancelled.customer_email && cancelled.customer_email.trim().length > 0) {
    try {
      await sendBookingCancellationEmail(cancelled as BookingRecord);
    } catch (error) {
      console.error("[jobs][booking.cancelled][email]", error);
    }
  }
}

export async function enqueueBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  await processBookingCreatedSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}

export async function enqueueBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  await processBookingUpdatedSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}

export async function enqueueBookingCancelledSideEffects(
  payload: BookingCancelledSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  await processBookingCancelledSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}

export {
  processBookingCreatedSideEffects,
  processBookingUpdatedSideEffects,
  processBookingCancelledSideEffects,
  safeBookingPayload,
};
