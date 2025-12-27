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
import { enqueueEmailJob, removeEmailJob } from "@/server/queue/email";
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
  emailProvided?: boolean;
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
const REVIEW_DELAY_MINUTES = 180; // 3 hours after visit ends
const INLINE_EMAIL_DELAY_CAP_MS = 48 * 60 * 60 * 1000;

type EmailPrefs = {
  sendReminder24h: boolean;
  sendReminderShort: boolean;
  sendReviewRequest: boolean;
};

// All guest emails are always enabled and cannot be disabled by restaurants.
// This ensures consistent guest communication across all venues.
const ALWAYS_ENABLED_EMAIL_PREFS: EmailPrefs = {
  sendReminder24h: true,
  sendReminderShort: true,
  sendReviewRequest: true,
} as const;

async function fetchRestaurantEmailPrefs(
  _restaurantId: string,
  _client?: SupabaseClient<Database, "public", "public">,
): Promise<EmailPrefs> {
  // All emails are always enabled - restaurant preferences are no longer checked.
  return ALWAYS_ENABLED_EMAIL_PREFS;
}

async function fetchRestaurantTimezone(
  restaurantId: string,
  client: SupabaseClient<Database, "public", "public"> = getServiceSupabaseClient(),
): Promise<string> {
  try {
    const { data } = await client
      .from("restaurants")
      .select("timezone")
      .eq("id", restaurantId)
      .maybeSingle();
    return data?.timezone || 'Europe/London';
  } catch {
    return 'Europe/London';
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

// ============================================================================
// SMART EMAIL SCHEDULING
// Based on 2024 email marketing research for optimal engagement:
// - Peak engagement: 9 AM - 12 PM (morning) and 1 PM - 3 PM (afternoon)
// - Secondary peak: 5 PM - 8 PM (post-work evening check)
// - Avoid: 10 PM - 7 AM (sleep hours - very low open rates)
// ============================================================================

const OPTIMAL_SEND_HOURS = {
  morningStart: 9,   // 9 AM - earliest optimal send time
  eveningEnd: 20,    // 8 PM - latest optimal send time
  eveningFallback: 19, // 7 PM - fallback for pre-event emails that would land in sleep hours
  nextDayStart: 10,  // 10 AM - comfortable start time for pushed emails
};

type ScheduleMode = 'post-event' | 'pre-event';

/**
 * Gets the local hour for a given timestamp in a specific timezone
 */
function getLocalHour(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.getUTCHours();
  }
}

/**
 * Checks if a given hour falls within optimal sending window (9 AM - 8 PM)
 */
function isWithinOptimalHours(hour: number): boolean {
  return hour >= OPTIMAL_SEND_HOURS.morningStart && hour < OPTIMAL_SEND_HOURS.eveningEnd;
}

/**
 * Adjusts a scheduled email timestamp to fall within optimal sending hours.
 * 
 * For POST-EVENT emails (e.g., review requests after a visit):
 *   - If outside 9 AM - 8 PM, delay to 10 AM next morning
 * 
 * For PRE-EVENT emails (e.g., reminders before a booking):
 *   - If outside 9 AM - 8 PM but would still be before the event, move to:
 *     - Previous evening (7 PM) if there's time
 *     - Same day morning (9 AM) if the event is later that day
 *   - Never schedule a reminder AFTER the event it's reminding about
 * 
 * @param proposedTimeMs - The initially calculated send time in milliseconds
 * @param timezone - The restaurant/guest timezone (default: Europe/London)
 * @param mode - 'post-event' for review requests, 'pre-event' for reminders
 * @param eventTimeMs - For pre-event mode, the time of the booking (must not send after this)
 * @returns Adjusted delay in milliseconds from now, or null if should skip
 */
function adjustToOptimalSendTime(
  proposedTimeMs: number,
  timezone = 'Europe/London',
  mode: ScheduleMode = 'post-event',
  eventTimeMs?: number,
): number | null {
  const proposedDate = new Date(proposedTimeMs);
  const localHour = getLocalHour(proposedDate, timezone);

  // If already within optimal hours, no adjustment needed
  if (isWithinOptimalHours(localHour)) {
    const delayMs = proposedTimeMs - Date.now();
    console.log(`[smart-schedule] ✅ Already optimal: ${proposedDate.toISOString()} (${localHour}:00 ${timezone})`);
    return Math.max(0, delayMs);
  }

  let adjustedDate = new Date(proposedDate);

  if (mode === 'post-event') {
    // POST-EVENT (review requests): Push to next morning
    if (localHour >= OPTIMAL_SEND_HOURS.eveningEnd) {
      // After 8 PM - push to 10 AM next day
      adjustedDate.setDate(adjustedDate.getDate() + 1);
      const hoursToAdd = OPTIMAL_SEND_HOURS.nextDayStart - localHour;
      adjustedDate.setHours(adjustedDate.getHours() + (24 + hoursToAdd));
    } else if (localHour < OPTIMAL_SEND_HOURS.morningStart) {
      // Before 9 AM - push to 10 AM same day
      const hoursToAdd = OPTIMAL_SEND_HOURS.nextDayStart - localHour;
      adjustedDate.setHours(adjustedDate.getHours() + hoursToAdd);
    }
  } else {
    // PRE-EVENT (reminders): Need to stay BEFORE the event
    if (!eventTimeMs) {
      // Safety: if no event time provided, fall back to post-event logic
      return adjustToOptimalSendTime(proposedTimeMs, timezone, 'post-event');
    }

    if (localHour >= OPTIMAL_SEND_HOURS.eveningEnd) {
      // After 8 PM - try next morning at 9 AM if event is later
      const nextMorning = new Date(proposedDate);
      nextMorning.setDate(nextMorning.getDate() + 1);
      const hoursToAdd = OPTIMAL_SEND_HOURS.morningStart - localHour;
      nextMorning.setHours(nextMorning.getHours() + (24 + hoursToAdd));

      if (nextMorning.getTime() < eventTimeMs) {
        adjustedDate = nextMorning;
      } else {
        // Can't push to morning, it would be after the event - send at 7 PM same day
        const hoursBack = localHour - OPTIMAL_SEND_HOURS.eveningFallback;
        adjustedDate.setHours(adjustedDate.getHours() - hoursBack);
      }
    } else if (localHour < OPTIMAL_SEND_HOURS.morningStart) {
      // Before 9 AM (e.g., 6 AM for an 8 AM booking)
      // Option 1: Push to 9 AM if event is later
      const sameDayMorning = new Date(proposedDate);
      const hoursToAdd = OPTIMAL_SEND_HOURS.morningStart - localHour;
      sameDayMorning.setHours(sameDayMorning.getHours() + hoursToAdd);

      if (sameDayMorning.getTime() < eventTimeMs) {
        adjustedDate = sameDayMorning;
      } else {
        // Can't push to morning, send previous evening at 7 PM instead
        const prevEvening = new Date(proposedDate);
        prevEvening.setDate(prevEvening.getDate() - 1);
        prevEvening.setHours(OPTIMAL_SEND_HOURS.eveningFallback + (24 - localHour));

        if (prevEvening.getTime() > Date.now()) {
          adjustedDate = prevEvening;
        } else {
          // Previous evening is in the past, can't schedule
          console.log(`[smart-schedule] ❌ Cannot schedule: previous evening is in the past`);
          return null;
        }
      }
    }

    // Final check: ensure we're still before the event
    if (adjustedDate.getTime() >= eventTimeMs) {
      console.log(`[smart-schedule] ❌ Cannot schedule: adjusted time would be after event`);
      return null;
    }
  }

  const adjustedDelayMs = adjustedDate.getTime() - Date.now();

  // Log the adjustment for debugging
  console.log(`[smart-schedule] 📧 Mode: ${mode}`);
  console.log(`[smart-schedule]    Original: ${proposedDate.toISOString()} (${localHour}:00 ${timezone})`);
  console.log(`[smart-schedule]    Adjusted: ${adjustedDate.toISOString()} (delay: ${Math.round(adjustedDelayMs / 60000)} min)`);

  return Math.max(0, adjustedDelayMs);
}

async function sendEmailInlineWithDelay(
  delayMs: number | null,
  sendFn: () => Promise<void>,
  logLabel: string,
): Promise<void> {
  if (delayMs === null) return;
  if (delayMs <= 0) {
    await Promise.resolve(sendFn());
    return;
  }

  const timeout = Math.min(delayMs, INLINE_EMAIL_DELAY_CAP_MS);
  setTimeout(() => {
    void Promise.resolve(sendFn()).catch((error) => {
      console.error(`[jobs][${logLabel}][inline-delay]`, error);
    });
  }, timeout);
}

async function scheduleReminderJob(
  booking: BookingRecord,
  restaurantId: string,
  variant: "reminder_24h" | "reminder_short",
  minutesBefore: number,
  prefs: EmailPrefs,
  timezone = 'Europe/London',
) {
  if (variant === "reminder_24h" && !prefs.sendReminder24h) return;
  if (variant === "reminder_short" && !prefs.sendReminderShort) return;
  if (!isValidEmail(booking.customer_email) || !booking.start_at) return;

  const baseDelayMs = computeDelayMs(booking.start_at, minutesBefore);
  if (baseDelayMs === null || baseDelayMs <= 0) {
    // Too close or past; skip scheduling.
    return;
  }

  // Calculate the proposed send time and event time
  const proposedSendTime = Date.now() + baseDelayMs;
  const eventTime = new Date(booking.start_at).getTime();

  // Apply smart scheduling to ensure we only send during optimal hours (9 AM - 8 PM)
  // For pre-event emails, this will try to move to previous evening or next morning
  // while ensuring the reminder still arrives BEFORE the booking
  const optimizedDelayMs = adjustToOptimalSendTime(proposedSendTime, timezone, 'pre-event', eventTime);

  // If smart scheduling returns null, we can't schedule this reminder properly
  if (optimizedDelayMs === null) {
    console.log(`[reminder-job] Booking ${booking.id} (${variant}): Cannot schedule - skipping`);
    return;
  }

  console.log(`[reminder-job] Booking ${booking.id} (${variant}): Base delay ${Math.round(baseDelayMs / 60000)} min, Optimized delay ${Math.round(optimizedDelayMs / 60000)} min`);

  if (isEmailQueueEnabled()) {
    await enqueueEmailJob(
      {
        bookingId: booking.id,
        restaurantId,
        type: variant,
        scheduledFor: new Date(Date.now() + optimizedDelayMs).toISOString(),
      },
      { jobId: `${variant}:${booking.id}`, delayMs: optimizedDelayMs },
    );
  } else if (optimizedDelayMs >= 0) {
    await sendEmailInlineWithDelay(
      optimizedDelayMs,
      () => sendBookingReminderEmail(booking, { variant: variant === "reminder_short" ? "short" : "standard" }),
      `booking.${variant}`,
    );
  }
}

async function scheduleReviewJob(booking: BookingRecord, restaurantId: string, timezone = 'Europe/London') {
  // prefs check will be done by caller and worker
  if (!isValidEmail(booking.customer_email)) return;

  // Default anchor: end_at then start_at then updated_at.
  const anchorIso = booking.end_at ?? booking.start_at ?? booking.updated_at ?? booking.created_at;
  const baseDelayMs = computeDelayMs(anchorIso, -REVIEW_DELAY_MINUTES); // 3 hours after visit ends

  if (baseDelayMs === null) return;

  // Calculate the proposed send time
  const proposedSendTime = Date.now() + baseDelayMs;

  // Apply smart scheduling to ensure we only send during optimal hours (9 AM - 8 PM)
  // This improves open rates by avoiding late night/early morning sends
  const optimizedDelayMs = adjustToOptimalSendTime(proposedSendTime, timezone, 'post-event');

  // If smart scheduling returns null, it means we can't schedule this email
  if (optimizedDelayMs === null) {
    console.log(`[review-job] Booking ${booking.id}: Cannot schedule review email - skipping`);
    return;
  }

  console.log(`[review-job] Booking ${booking.id}: Base delay ${Math.round(baseDelayMs / 60000)} min, Optimized delay ${Math.round(optimizedDelayMs / 60000)} min`);

  if (isEmailQueueEnabled() && optimizedDelayMs > 0) {
    await enqueueEmailJob(
      {
        bookingId: booking.id,
        restaurantId,
        type: "review_request",
        scheduledFor: new Date(Date.now() + optimizedDelayMs).toISOString(),
      },
      { jobId: `review_request:${booking.id}`, delayMs: optimizedDelayMs },
    );
  } else if (optimizedDelayMs >= 0) {
    await sendEmailInlineWithDelay(optimizedDelayMs, () => sendBookingReviewRequestEmail(booking), "booking.review_request");
  }
}

async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  _supabase?: SupabaseLike,
): Promise<boolean> {
  const client = resolveSupabase(_supabase);
  const { booking, idempotencyKey, restaurantId } = payload;
  let queuedViaQueue = false;
  const normalizedEmail = booking.customer_email?.trim?.() ?? '';
  const shouldSendEmail = (payload.emailProvided ?? true) && normalizedEmail.length > 0;
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

  if (!SUPPRESS_EMAILS && shouldSendEmail) {
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
  if (!SUPPRESS_EMAILS && shouldSendEmail && booking.status === "confirmed") {
    const timezone = await fetchRestaurantTimezone(restaurantId, client);
    await scheduleReminderJob(
      booking as BookingRecord,
      restaurantId,
      "reminder_24h",
      REMINDER_24H_MINUTES,
      emailPrefs,
      timezone,
    );
    await scheduleReminderJob(
      booking as BookingRecord,
      restaurantId,
      "reminder_short",
      REMINDER_SHORT_MINUTES,
      emailPrefs,
      timezone,
    );
  }

  // Edge: if created as completed (rare), schedule review with smart timing.
  if (!SUPPRESS_EMAILS && shouldSendEmail && booking.status === "completed" && emailPrefs.sendReviewRequest) {
    const timezone = await fetchRestaurantTimezone(restaurantId, client);
    await scheduleReviewJob(booking as BookingRecord, restaurantId, timezone);
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
        // Try to cancel any pending "request received" email to avoid confusion/spam
        // If it was scheduled with a delay, and we confirm before that delay, we should axe it.
        await removeEmailJob(`request_received:${current.id}`);
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

    const timezone = await fetchRestaurantTimezone(restaurantId, resolveSupabase(_supabase));
    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      "reminder_24h",
      REMINDER_24H_MINUTES,
      prefs,
      timezone,
    );
    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      "reminder_short",
      REMINDER_SHORT_MINUTES,
      prefs,
      timezone,
    );
  }

  if (transitionedToPending || confirmedFromPending) {
    return;
  }

  if (!SUPPRESS_EMAILS && current.customer_email && current.customer_email.trim().length > 0) {
    if (isEmailQueueEnabled()) {
      try {
        await enqueueEmailJob(
          {
            bookingId: current.id,
            restaurantId,
            type: "updated",
            scheduledFor: null,
          },
          {
            jobId: `updated:${current.id}`,
            delayMs: 0,
          },
        );
      } catch (error) {
        console.error("[jobs][booking.updated][queue-update]", error);
        try {
          await sendBookingUpdateEmail(current as BookingRecord);
        } catch (fallbackError) {
          console.error("[jobs][booking.updated][email-fallback]", fallbackError);
        }
      }
    } else {
      try {
        await sendBookingUpdateEmail(current as BookingRecord);
      } catch (error) {
        console.error("[jobs][booking.updated][email]", error);
      }
    }
  }

  const completedFromOtherStatus = currStatus === "completed" && prevStatus !== "completed";
  if (!SUPPRESS_EMAILS && completedFromOtherStatus && prefs.sendReviewRequest) {
    const timezone = await fetchRestaurantTimezone(restaurantId, resolveSupabase(_supabase));
    await scheduleReviewJob(current as BookingRecord, restaurantId, timezone);
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
    const jobType = cancelledBy === "customer" ? "cancelled" : "restaurant_cancellation";
    const sendFn =
      cancelledBy === "customer" ? sendBookingCancellationEmail : sendRestaurantCancellationEmail;

    if (isEmailQueueEnabled()) {
      try {
        await enqueueEmailJob(
          {
            bookingId: cancelled.id,
            restaurantId,
            type: jobType,
            scheduledFor: null,
          },
          {
            jobId: `${jobType}:${cancelled.id}`,
            delayMs: 0,
          },
        );
      } catch (error) {
        console.error("[jobs][booking.cancelled][queue]", error);
        try {
          await sendFn(cancelled as BookingRecord);
        } catch (fallbackError) {
          console.error("[jobs][booking.cancelled][email-fallback]", fallbackError);
        }
      }
    } else {
      try {
        await sendFn(cancelled as BookingRecord);
      } catch (error) {
        console.error("[jobs][booking.cancelled][email]", error);
      }
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
