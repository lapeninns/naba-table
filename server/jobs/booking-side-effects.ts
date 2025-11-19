import { z } from "zod";


import { recordBookingCancelledEvent, recordBookingCreatedEvent } from "@/server/analytics";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendBookingUpdateEmail,
  sendRestaurantCancellationEmail,
} from "@/server/emails/bookings";
import {
  getAutoAssignCreatedEmailDeferMinutes,
  isAutoAssignOnBookingEnabled,
  isEmailQueueEnabled,
} from "@/server/feature-flags";
import { enqueueEmailJob } from "@/server/queue/email";
import { getServiceSupabaseClient } from "@/server/supabase";


import type { BookingRecord } from "@/server/bookings";
import type { Database } from "@/types/supabase";
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
const REMINDER_24H_MINUTES = 24 * 60;
const REMINDER_SHORT_MINUTES = 2 * 60;
const REVIEW_DELAY_MINUTES = 60;

type EmailPrefs = {
  sendReminder24h: boolean;
  sendReminderShort: boolean;
  sendReviewRequest: boolean;
};

const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  sendReminder24h: true,
  sendReminderShort: true,
  sendReviewRequest: true,
};

async function fetchRestaurantEmailPrefs(
  restaurantId: string,
  client: SupabaseClient<Database, "public", "public"> = getServiceSupabaseClient(),
): Promise<EmailPrefs> {
  try {
    const { data, error } = await client
      .from("restaurants")
      .select("email_send_reminder_24h,email_send_reminder_short,email_send_review_request")
      .eq("id", restaurantId)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_EMAIL_PREFS;
    }

    return {
      sendReminder24h: data.email_send_reminder_24h ?? true,
      sendReminderShort: data.email_send_reminder_short ?? true,
      sendReviewRequest: data.email_send_review_request ?? true,
    };
  } catch {
    return DEFAULT_EMAIL_PREFS;
  }
}

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes("@"));
}

function computeDelayMs(targetIso: string | null | undefined, minutesBeforeOrAfter: number): number | null {
  if (!targetIso) return null;
  const ts = new Date(targetIso).getTime();
  if (Number.isNaN(ts)) return null;
  return ts - Date.now() - minutesBeforeOrAfter * 60_000;
}

async function scheduleReminderJob(
  booking: BookingRecord,
  restaurantId: string,
  variant: "reminder_24h" | "reminder_short",
  minutesBefore: number,
  prefs: EmailPrefs,
) {
  if (variant === "reminder_24h" && !prefs.sendReminder24h) return;
  if (variant === "reminder_short" && !prefs.sendReminderShort) return;
  if (!isValidEmail(booking.customer_email) || !booking.start_at) return;
  const delayMs = computeDelayMs(booking.start_at, minutesBefore);
  if (delayMs !== null && delayMs <= 0) {
    // Too close or past; skip scheduling.
    return;
  }

  if (isEmailQueueEnabled()) {
    await enqueueEmailJob(
      {
        bookingId: booking.id,
        restaurantId,
        type: variant,
        scheduledFor: delayMs ? new Date(Date.now() + delayMs).toISOString() : null,
      },
      { jobId: `${variant}:${booking.id}`, delayMs: delayMs ?? 0 },
    );
  } else {
    if (delayMs === null || delayMs <= 0) {
      await sendBookingReminderEmail(booking, { variant: variant === "reminder_short" ? "short" : "standard" });
    }
  }
}

async function scheduleReviewJob(booking: BookingRecord, restaurantId: string) {
  // prefs check will be done by caller and worker
  if (!isValidEmail(booking.customer_email)) return;
  // Default anchor: end_at then start_at then updated_at.
  const anchorIso = booking.end_at ?? booking.start_at ?? booking.updated_at ?? booking.created_at;
  const delayMs = computeDelayMs(anchorIso, -REVIEW_DELAY_MINUTES); // negative subtract means add minutes after

  if (isEmailQueueEnabled() && delayMs !== null && delayMs > 0) {
    await enqueueEmailJob(
      {
        bookingId: booking.id,
        restaurantId,
        type: "review_request",
        scheduledFor: new Date(Date.now() + delayMs).toISOString(),
      },
      { jobId: `review_request:${booking.id}`, delayMs },
    );
  } else {
    if (delayMs === null || delayMs <= 0) {
      await sendBookingReviewRequestEmail(booking);
    }
  }
}

async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  _supabase?: SupabaseLike,
): Promise<boolean> {
  const client = resolveSupabase(_supabase);
  const { booking, idempotencyKey, restaurantId } = payload;
  let queuedViaQueue = false;
  const emailPrefs = await fetchRestaurantEmailPrefs(restaurantId, client);

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
    const isPending = booking.status === "pending" || booking.status === "pending_allocation";
    const deferMinutes = isAutoAssignOnBookingEnabled() ? getAutoAssignCreatedEmailDeferMinutes() : 0;
    const shouldDeferPending = deferMinutes > 0 && isPending;
    const delayMs = shouldDeferPending ? Math.max(0, Math.min(deferMinutes, 120)) * 60_000 : 0;

    if (isPending) {
      if (isEmailQueueEnabled()) {
        try {
          await enqueueEmailJob(
            {
              bookingId: booking.id,
              restaurantId,
              type: "request_received",
              scheduledFor: delayMs > 0 ? new Date(Date.now() + delayMs).toISOString() : null,
            },
            {
              jobId: `request_received:${booking.id}`,
              delayMs,
            },
          );
          queuedViaQueue = true;
        } catch (error) {
          console.error("[jobs][booking.created][queue]", error);
          try {
            await sendBookingConfirmationEmail(booking as BookingRecord);
          } catch (fallbackError) {
            console.error("[jobs][booking.created][email-fallback]", fallbackError);
          }
        }
      } else {
        try {
          await sendBookingConfirmationEmail(booking as BookingRecord);
        } catch (error) {
          console.error("[jobs][booking.created][email]", error);
        }
      }
    } else {
      if (isEmailQueueEnabled()) {
        try {
          await enqueueEmailJob(
            {
              bookingId: booking.id,
              restaurantId,
              type: "confirmation",
              scheduledFor: null,
            },
            {
              jobId: `confirmation:${booking.id}`,
              delayMs: 0,
            },
          );
          queuedViaQueue = true;
        } catch (error) {
          console.error("[jobs][booking.created][queue-confirmation]", error);
          try {
            await sendBookingConfirmationEmail(booking as BookingRecord);
          } catch (fallbackError) {
            console.error("[jobs][booking.created][email-fallback]", fallbackError);
          }
        }
      } else {
        try {
          await sendBookingConfirmationEmail(booking as BookingRecord);
        } catch (error) {
          console.error("[jobs][booking.created][email]", error);
        }
      }
    }
  }

  // Schedule pre-visit reminders if already confirmed at creation.
  if (!SUPPRESS_EMAILS && booking.status === "confirmed") {
    await scheduleReminderJob(
      booking as BookingRecord,
      restaurantId,
      "reminder_24h",
      REMINDER_24H_MINUTES,
      emailPrefs,
    );
    await scheduleReminderJob(
      booking as BookingRecord,
      restaurantId,
      "reminder_short",
      REMINDER_SHORT_MINUTES,
      emailPrefs,
    );
  }

  // Edge: if created as completed (rare), schedule review.
  if (!SUPPRESS_EMAILS && booking.status === "completed" && emailPrefs.sendReviewRequest) {
    await scheduleReviewJob(booking as BookingRecord, restaurantId);
  }

  return queuedViaQueue;
}

async function processBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  _supabase?: SupabaseLike,
) {
  const { current, previous, restaurantId } = payload;
  const prefs = await fetchRestaurantEmailPrefs(restaurantId, resolveSupabase(_supabase));
  const prevStatus = previous.status ?? null;
  const currStatus = current.status ?? null;

  const transitionedToPending =
    (currStatus === "pending" || currStatus === "pending_allocation") &&
    currStatus !== prevStatus;

  const confirmedFromPending =
    (prevStatus === "pending" || prevStatus === "pending_allocation") &&
    currStatus === "confirmed";

  if (confirmedFromPending && !SUPPRESS_EMAILS && isValidEmail(current.customer_email)) {
    if (isEmailQueueEnabled()) {
      try {
        await enqueueEmailJob(
          {
            bookingId: current.id,
            restaurantId,
            type: "confirmation",
            scheduledFor: null,
          },
          {
            jobId: `confirmation:${current.id}`,
            delayMs: 0,
          },
        );
      } catch (error) {
        console.error("[jobs][booking.updated][queue-confirmation]", error);
        try {
          await sendBookingConfirmationEmail(current as BookingRecord);
        } catch (fallbackError) {
          console.error("[jobs][booking.updated][email-fallback]", fallbackError);
        }
      }
    } else {
      try {
        await sendBookingConfirmationEmail(current as BookingRecord);
      } catch (error) {
        console.error("[jobs][booking.updated][email]", error);
      }
    }

    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      "reminder_24h",
      REMINDER_24H_MINUTES,
      prefs,
    );
    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      "reminder_short",
      REMINDER_SHORT_MINUTES,
      prefs,
    );
  }

  if (transitionedToPending || confirmedFromPending) {
    return;
  }

  if (!SUPPRESS_EMAILS && current.customer_email && current.customer_email.trim().length > 0) {
    try {
      await sendBookingUpdateEmail(current as BookingRecord);
    } catch (error) {
      console.error("[jobs][booking.updated][email]", error);
    }
  }

  const completedFromOtherStatus = currStatus === "completed" && prevStatus !== "completed";
  if (!SUPPRESS_EMAILS && completedFromOtherStatus && prefs.sendReviewRequest) {
    await scheduleReviewJob(current as BookingRecord, restaurantId);
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
      const sendFn =
        cancelledBy === "customer" ? sendBookingCancellationEmail : sendRestaurantCancellationEmail;
      await sendFn(cancelled as BookingRecord);
    } catch (error) {
      console.error("[jobs][booking.cancelled][email]", error);
    }
  }
}

export async function enqueueBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  const queued = await processBookingCreatedSideEffects(payload, options?.supabase);
  return { queued } as const;
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
