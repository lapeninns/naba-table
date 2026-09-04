import { z } from 'zod';

import { safeGoogleReviewUrl } from '@/lib/security/safe-url';
import { recordBookingCancelledEvent, recordBookingCreatedEvent } from '@/server/analytics';
import { isBookingWhatsAppEventEligible } from '@/server/booking/whatsapp-consent';
import { sendFirstBookingConfirmationNotifications } from '@/server/bookings/confirmation-notifications';
import { normalizePhone } from '@/server/customers';
import {
  sendBookingCancellationEmail,
  sendBookingReminderEmail,
  sendBookingReviewRequestEmail,
  sendBookingUpdateEmail,
  sendRestaurantCancellationEmail,
} from '@/server/emails/bookings';
import { recordObservabilityEvent } from '@/server/observability';
import { enqueueEmailJob } from '@/server/queue/email';
import { cancelEmailIntents } from '@/server/queue/email-intents';
import { scheduleMobileReviewIntent } from '@/server/queue/mobile-review-intents';
import { createReviewJourney } from '@/server/reviews/journeys';
import { isEmailQueueEnabled } from '@/server/runtime-policy';
import { sendGuestBookingCancellationSms, sendGuestBookingUpdateSms } from '@/server/sms/bookings';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { Database } from '@/types/supabase';
import type { Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const BOOKING_CREATED_EVENT = 'sajiloreservex/booking.created.side-effects' as const;
export const BOOKING_UPDATED_EVENT = 'sajiloreservex/booking.updated.side-effects' as const;
export const BOOKING_CANCELLED_EVENT = 'sajiloreservex/booking.cancelled.side-effects' as const;

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
  cancelledBy: 'customer' | 'staff' | 'system';
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
const SUPPRESS_EMAILS =
  process.env.LOAD_TEST_DISABLE_EMAILS === 'true' || process.env.SUPPRESS_EMAILS === 'true';
const REMINDER_24H_MINUTES = 24 * 60;
const REMINDER_SHORT_MINUTES = 2 * 60;
const REVIEW_DELAY_MINUTES = 180; // 3 hours after visit ends
const INLINE_EMAIL_DELAY_CAP_MS = 48 * 60 * 60 * 1000;

const SERVERLESS_LIKE_HOSTS = ['VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'NETLIFY', 'CF_PAGES'];

function isServerlessHost(): boolean {
  return SERVERLESS_LIKE_HOSTS.some((key) => Boolean(process.env[key]));
}

let warnedAboutInlineFallback = false;
async function reportInlineFallbackInUse(context: {
  bookingId: string;
  restaurantId: string;
  variant: string;
  delayMs: number;
}): Promise<void> {
  if (process.env.NODE_ENV !== 'production' && !isServerlessHost()) {
    return;
  }
  if (warnedAboutInlineFallback) {
    return;
  }
  warnedAboutInlineFallback = true;
  console.error(
    '[jobs][email-fallback] inline setTimeout fallback engaged in production/serverless; scheduled emails will NOT survive invocation recycling. Configure the durable email queue before deploying.',
    context,
  );
  try {
    await recordObservabilityEvent({
      source: 'jobs.email',
      eventType: 'email_queue.disabled_in_serverless',
      severity: 'error',
      context,
      restaurantId: context.restaurantId,
      bookingId: context.bookingId,
    });
  } catch {
    // observability is best-effort; never let it block booking flows
  }
}

type EmailPrefs = {
  googleReviewUrl: string | null;
  sendReminder24h: boolean;
  sendReminderShort: boolean;
  sendReviewRequest: boolean;
};

const ALWAYS_ENABLED_EMAIL_PREFS: EmailPrefs = {
  googleReviewUrl: null,
  sendReminder24h: true,
  sendReminderShort: true,
  sendReviewRequest: true,
} as const;

async function fetchRestaurantEmailPrefs(
  restaurantId: string,
  client: SupabaseClient<Database, 'public', 'public'> = getServiceSupabaseClient(),
): Promise<EmailPrefs> {
  const { data, error } = await client
    .from('restaurants')
    .select('email_send_review_request, google_review_url')
    .eq('id', restaurantId)
    .maybeSingle();

  if (error) {
    console.warn('[jobs][review-job] failed to load venue review preference', {
      restaurantId,
      error: error.message,
    });
  }

  return {
    ...ALWAYS_ENABLED_EMAIL_PREFS,
    googleReviewUrl: safeGoogleReviewUrl(data?.google_review_url),
    sendReviewRequest: !error && data?.email_send_review_request === true,
  };
}

async function fetchRestaurantTimezone(
  restaurantId: string,
  client: SupabaseClient<Database, 'public', 'public'> = getServiceSupabaseClient(),
): Promise<string> {
  try {
    const { data } = await client
      .from('restaurants')
      .select('timezone')
      .eq('id', restaurantId)
      .maybeSingle();
    return data?.timezone || 'Europe/London';
  } catch {
    return 'Europe/London';
  }
}

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 3 && value.includes('@'));
}

function hasValidSmsRecipient(value?: string | null): boolean {
  return normalizePhone(value).length > 0;
}

function hasReviewWhatsAppCandidate(booking: BookingRecord): boolean {
  return isBookingWhatsAppEventEligible({
    booking,
    event: 'post_visit_review',
    phone: booking.customer_phone,
  });
}

function computeDelayMs(
  targetIso: string | null | undefined,
  minutesBeforeOrAfter: number,
): number | null {
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
// - Commute dead zone (post-event only): 4 PM - 7 PM sends defer to 7 PM
// ============================================================================

const OPTIMAL_SEND_HOURS = {
  morningStart: 9, // 9 AM - earliest optimal send time
  eveningEnd: 20, // 8 PM - latest optimal send time
  eveningFallback: 19, // 7 PM - fallback for pre-event emails that would land in sleep hours
  nextDayStart: 10, // 10 AM - comfortable start time for pushed emails
  commuteStart: 16, // 4 PM - start of the late-afternoon commute dead zone (post-event only)
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
 *   - If proposed between 4 PM and 7 PM, defer to 7 PM the same evening
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

  // POST-EVENT sends proposed during the late-afternoon commute (4 PM - 7 PM) engage
  // poorly; defer them to the 7 PM post-work evening peak (minutes preserved).
  // Pre-event reminders are exempt: a 5 PM reminder for an 8 PM booking is intentional.
  const inCommuteWindow =
    localHour >= OPTIMAL_SEND_HOURS.commuteStart && localHour < OPTIMAL_SEND_HOURS.eveningFallback;
  if (mode === 'post-event' && inCommuteWindow) {
    const deferred = new Date(proposedDate);
    deferred.setHours(deferred.getHours() + (OPTIMAL_SEND_HOURS.eveningFallback - localHour));
    return Math.max(0, deferred.getTime() - Date.now());
  }

  // If already within optimal hours, no adjustment needed
  if (isWithinOptimalHours(localHour)) {
    const delayMs = proposedTimeMs - Date.now();
    return Math.max(0, delayMs);
  }

  let adjustedDate = new Date(proposedDate);

  if (mode === 'post-event') {
    // POST-EVENT (review requests): Push to next morning
    if (localHour >= OPTIMAL_SEND_HOURS.eveningEnd) {
      // After 8 PM - push to 10 AM next day
      const hoursToAdd = 24 - localHour + OPTIMAL_SEND_HOURS.nextDayStart;
      adjustedDate.setHours(adjustedDate.getHours() + hoursToAdd);
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
          return null;
        }
      }
    }

    // Final check: ensure we're still before the event
    if (adjustedDate.getTime() >= eventTimeMs) {
      return null;
    }
  }

  const adjustedDelayMs = adjustedDate.getTime() - Date.now();

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
  variant: 'reminder_24h' | 'reminder_short',
  minutesBefore: number,
  prefs: EmailPrefs,
  timezone = 'Europe/London',
) {
  if (variant === 'reminder_24h' && !prefs.sendReminder24h) return;
  if (variant === 'reminder_short' && !prefs.sendReminderShort) return;
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
  const optimizedDelayMs = adjustToOptimalSendTime(
    proposedSendTime,
    timezone,
    'pre-event',
    eventTime,
  );

  // If smart scheduling returns null, we can't schedule this reminder properly
  if (optimizedDelayMs === null) {
    return;
  }

  if (isEmailQueueEnabled()) {
    try {
      await enqueueEmailJob(
        {
          bookingId: booking.id,
          restaurantId,
          type: variant,
          scheduledFor: new Date(Date.now() + optimizedDelayMs).toISOString(),
        },
        { jobId: `${variant}:${booking.id}`, delayMs: optimizedDelayMs },
      );
    } catch (error) {
      // Reminders are best-effort side effects; do not block booking lifecycle flows.
      console.warn('[jobs][reminder-job] failed to enqueue reminder email', {
        bookingId: booking.id,
        variant,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  // Fallback (dev-only / queue disabled): attempt a best-effort inline send.
  await reportInlineFallbackInUse({
    bookingId: booking.id,
    restaurantId,
    variant,
    delayMs: optimizedDelayMs,
  });
  await sendEmailInlineWithDelay(
    optimizedDelayMs,
    async () => {
      await sendBookingReminderEmail(booking, {
        variant: variant === 'reminder_short' ? 'short' : 'standard',
      });
    },
    `booking.${variant}`,
  );
}

async function scheduleReviewJob(
  booking: BookingRecord,
  restaurantId: string,
  options: {
    readonly allowEmail: boolean;
    readonly allowWhatsApp: boolean;
    readonly client: SupabaseLike;
    readonly timezone?: string;
  },
) {
  // Default anchor: end_at then start_at then updated_at.
  const anchorIso = booking.end_at ?? booking.start_at ?? booking.updated_at ?? booking.created_at;
  const baseDelayMs = computeDelayMs(anchorIso, -REVIEW_DELAY_MINUTES); // 3 hours after visit ends

  if (baseDelayMs === null) return;

  // Calculate the proposed send time
  const proposedSendTime = Date.now() + baseDelayMs;

  // Apply smart scheduling to ensure we only send during optimal hours (9 AM - 8 PM)
  // This improves open rates by avoiding late night/early morning sends
  const optimizedDelayMs = adjustToOptimalSendTime(
    proposedSendTime,
    options.timezone ?? 'Europe/London',
    'post-event',
  );

  // If smart scheduling returns null, it means we can't schedule this email
  if (optimizedDelayMs === null) {
    return;
  }

  // Always queue review requests when the email queue is enabled.
  // Avoid relying on setTimeout in serverless environments for delayed sends.
  const scheduledFor = new Date(Date.now() + Math.max(0, optimizedDelayMs)).toISOString();
  let journey;
  try {
    journey = await createReviewJourney(
      {
        bookingId: booking.id,
        emailEligible: options.allowEmail,
        restaurantId,
        scheduledFor,
        whatsappEligible: options.allowWhatsApp,
      },
      options.client,
    );
  } catch (error) {
    console.warn('[jobs][review-job] failed to create review journey', {
      bookingId: booking.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (journey.state === 'suppressed') return;

  if (journey.primaryChannel === 'whatsapp') {
    try {
      await scheduleMobileReviewIntent({
        booking,
        client: options.client,
        restaurantId,
        reviewRequestId: journey.reviewRequestId,
        scheduledFor,
      });
    } catch (error) {
      console.warn('[jobs][review-job] failed to enqueue review WhatsApp', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const emailScheduledFor =
    journey.primaryChannel === 'email' ? journey.scheduledFor : journey.followupScheduledFor;
  if (options.allowEmail && emailScheduledFor && isEmailQueueEnabled()) {
    const reviewStage = journey.primaryChannel === 'email' ? 'primary' : 'followup';
    try {
      await enqueueEmailJob(
        {
          bookingId: booking.id,
          restaurantId,
          type: 'review_request',
          scheduledFor: emailScheduledFor,
          reviewRequestId: journey.reviewRequestId,
          reviewStage,
        },
        {
          jobId: `review_request:${reviewStage}:${booking.id}`,
          delayMs: Math.max(0, new Date(emailScheduledFor).getTime() - Date.now()),
        },
      );
    } catch (error) {
      // Review requests are best-effort; do not block check-out flows.
      console.warn('[jobs][review-job] failed to enqueue review request email', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (!options.allowEmail || journey.primaryChannel !== 'email') {
    return;
  }

  // Fallback (dev-only / queue disabled): attempt a best-effort inline send.
  // Note: any delay > 0 is not reliable in serverless environments.
  if (optimizedDelayMs >= 0) {
    await reportInlineFallbackInUse({
      bookingId: booking.id,
      restaurantId,
      variant: 'review_request',
      delayMs: optimizedDelayMs,
    });
    if (options.allowEmail) {
      await sendEmailInlineWithDelay(
        optimizedDelayMs,
        async () => {
          await sendBookingReviewRequestEmail(booking);
        },
        'booking.review_request',
      );
    }
  }
}

async function processBookingCreatedSideEffects(
  payload: BookingCreatedSideEffectsPayload,
  _supabase?: SupabaseLike,
): Promise<boolean> {
  const client = resolveSupabase(_supabase);
  const { booking, idempotencyKey, restaurantId } = payload;

  const queuedViaQueue = false;
  const shouldSendEmail = (payload.emailProvided ?? true) && isValidEmail(booking.customer_email);
  const shouldSendSms = hasValidSmsRecipient(booking.customer_phone);
  const shouldSendConfirmationNotifications =
    booking.status === 'confirmed' && ((!SUPPRESS_EMAILS && shouldSendEmail) || shouldSendSms);

  const emailPrefs = await fetchRestaurantEmailPrefs(restaurantId, client);

  try {
    await recordBookingCreatedEvent(client, {
      bookingId: booking.id,
      restaurantId,
      customerId: booking.customer_id,
      status: booking.status as Tables<'bookings'>['status'],
      partySize: booking.party_size,
      bookingType: booking.booking_type as Tables<'bookings'>['booking_type'],
      seatingPreference: booking.seating_preference as Tables<'bookings'>['seating_preference'],
      source: booking.source ?? 'api',
      loyaltyPointsAwarded: booking.loyalty_points_awarded ?? 0,
      occurredAt: booking.created_at,
      clientRequestId: booking.client_request_id ?? undefined,
      idempotencyKey,
      pendingRef: booking.pending_ref ?? undefined,
    });
  } catch (error) {
    console.error('[jobs][booking.created][analytics]', error);
  }

  if (shouldSendConfirmationNotifications) {
    try {
      await sendFirstBookingConfirmationNotifications(booking as BookingRecord, {
        allowEmail: !SUPPRESS_EMAILS && shouldSendEmail,
        allowSms: shouldSendSms,
      });
    } catch (error) {
      console.error('[jobs][booking.created][confirmation-notifications]', error);
    }
  }

  // Schedule pre-visit reminders if already confirmed at creation.
  if (!SUPPRESS_EMAILS && shouldSendEmail && booking.status === 'confirmed') {
    try {
      const timezone = await fetchRestaurantTimezone(restaurantId, client);
      await scheduleReminderJob(
        booking as BookingRecord,
        restaurantId,
        'reminder_24h',
        REMINDER_24H_MINUTES,
        emailPrefs,
        timezone,
      );
      await scheduleReminderJob(
        booking as BookingRecord,
        restaurantId,
        'reminder_short',
        REMINDER_SHORT_MINUTES,
        emailPrefs,
        timezone,
      );
    } catch (error) {
      console.warn('[jobs][booking.created] failed to schedule reminders', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Edge: if created as completed (rare), schedule review with smart timing.
  if (
    booking.status === 'completed' &&
    emailPrefs.sendReviewRequest &&
    ((!SUPPRESS_EMAILS && shouldSendEmail) ||
      (Boolean(emailPrefs.googleReviewUrl) && hasReviewWhatsAppCandidate(booking as BookingRecord)))
  ) {
    const timezone = await fetchRestaurantTimezone(restaurantId, client);
    await scheduleReviewJob(booking as BookingRecord, restaurantId, {
      allowEmail: !SUPPRESS_EMAILS && shouldSendEmail,
      allowWhatsApp:
        Boolean(emailPrefs.googleReviewUrl) && hasReviewWhatsAppCandidate(booking as BookingRecord),
      client,
      timezone,
    });
  }

  return queuedViaQueue;
}

async function processBookingUpdatedSideEffects(
  payload: BookingUpdatedSideEffectsPayload,
  _supabase?: SupabaseLike,
  options: { readonly skipGuestUpdateNotifications?: boolean } = {},
) {
  const { current, previous, restaurantId } = payload;
  const prefs = await fetchRestaurantEmailPrefs(restaurantId, resolveSupabase(_supabase));
  const prevStatus = previous.status ?? null;
  const currStatus = current.status ?? null;

  const transitionedToPending =
    (currStatus === 'pending' || currStatus === 'pending_allocation') && currStatus !== prevStatus;

  const confirmedFromPending =
    (prevStatus === 'pending' || prevStatus === 'pending_allocation') && currStatus === 'confirmed';
  const leftConfirmed = prevStatus === 'confirmed' && currStatus !== 'confirmed';
  const leftCompleted = prevStatus === 'completed' && currStatus !== 'completed';

  if (leftConfirmed) {
    await cancelEmailIntents({
      bookingId: current.id,
      types: ['reminder_24h', 'reminder_short'],
    });
  }

  if (leftCompleted) {
    await cancelEmailIntents({
      bookingId: current.id,
      types: ['review_request'],
    });
  }

  const confirmedStartChanged =
    prevStatus === 'confirmed' &&
    currStatus === 'confirmed' &&
    previous.start_at !== current.start_at;

  if (confirmedStartChanged) {
    await cancelEmailIntents({
      bookingId: current.id,
      types: ['reminder_24h', 'reminder_short'],
    });

    if (!SUPPRESS_EMAILS && isValidEmail(current.customer_email)) {
      const timezone = await fetchRestaurantTimezone(restaurantId, resolveSupabase(_supabase));
      await scheduleReminderJob(
        current as BookingRecord,
        restaurantId,
        'reminder_24h',
        REMINDER_24H_MINUTES,
        prefs,
        timezone,
      );
      await scheduleReminderJob(
        current as BookingRecord,
        restaurantId,
        'reminder_short',
        REMINDER_SHORT_MINUTES,
        prefs,
        timezone,
      );
    }
  }

  if (
    confirmedFromPending &&
    ((!SUPPRESS_EMAILS && isValidEmail(current.customer_email)) ||
      hasValidSmsRecipient(current.customer_phone))
  ) {
    try {
      await sendFirstBookingConfirmationNotifications(current as BookingRecord, {
        allowEmail: !SUPPRESS_EMAILS && isValidEmail(current.customer_email),
        allowSms: hasValidSmsRecipient(current.customer_phone),
      });
    } catch (error) {
      console.error('[jobs][booking.updated][confirmation-notifications]', error);
    }

    const timezone = await fetchRestaurantTimezone(restaurantId, resolveSupabase(_supabase));
    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      'reminder_24h',
      REMINDER_24H_MINUTES,
      prefs,
      timezone,
    );
    await scheduleReminderJob(
      current as BookingRecord,
      restaurantId,
      'reminder_short',
      REMINDER_SHORT_MINUTES,
      prefs,
      timezone,
    );
  }

  if (transitionedToPending || confirmedFromPending) {
    return;
  }

  if (
    !options.skipGuestUpdateNotifications &&
    !SUPPRESS_EMAILS &&
    current.customer_email &&
    current.customer_email.trim().length > 0
  ) {
    try {
      await sendBookingUpdateEmail(current as BookingRecord);
    } catch (error) {
      console.error('[jobs][booking.updated][email]', error);
    }
  }

  if (!options.skipGuestUpdateNotifications && hasValidSmsRecipient(current.customer_phone)) {
    try {
      await sendGuestBookingUpdateSms(current as BookingRecord);
    } catch (error) {
      console.error('[jobs][booking.updated][sms]', error);
    }
  }

  const completedFromOtherStatus = currStatus === 'completed' && prevStatus !== 'completed';
  if (
    completedFromOtherStatus &&
    prefs.sendReviewRequest &&
    ((!SUPPRESS_EMAILS && isValidEmail(current.customer_email)) ||
      (Boolean(prefs.googleReviewUrl) && hasReviewWhatsAppCandidate(current as BookingRecord)))
  ) {
    const client = resolveSupabase(_supabase);
    const timezone = await fetchRestaurantTimezone(restaurantId, client);
    await scheduleReviewJob(current as BookingRecord, restaurantId, {
      allowEmail: !SUPPRESS_EMAILS && isValidEmail(current.customer_email),
      allowWhatsApp:
        Boolean(prefs.googleReviewUrl) && hasReviewWhatsAppCandidate(current as BookingRecord),
      client,
      timezone,
    });
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
      previousStatus: previous.status as Tables<'bookings'>['status'],
      cancelledBy,
      occurredAt: cancelled.updated_at,
    });
  } catch (error) {
    console.error('[jobs][booking.cancelled][analytics]', error);
  }

  if (isEmailQueueEnabled()) {
    try {
      await cancelEmailIntents({
        bookingId: cancelled.id,
        types: ['reminder_24h', 'reminder_short', 'review_request'],
      });
    } catch (error) {
      console.warn('[jobs][booking.cancelled] failed to cancel pending email intents', {
        bookingId: cancelled.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!SUPPRESS_EMAILS && cancelled.customer_email && cancelled.customer_email.trim().length > 0) {
    const sendFn =
      cancelledBy === 'customer' ? sendBookingCancellationEmail : sendRestaurantCancellationEmail;
    try {
      await sendFn(cancelled as BookingRecord);
    } catch (error) {
      console.error('[jobs][booking.cancelled][email]', error);
    }
  }

  if (hasValidSmsRecipient(cancelled.customer_phone)) {
    try {
      await sendGuestBookingCancellationSms(cancelled as BookingRecord, { cancelledBy });
    } catch (error) {
      console.error('[jobs][booking.cancelled][sms]', error);
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
  options?: {
    supabase?: SupabaseLike;
    /**
     * Skip sending update emails. Set to true when the modification flow
     * has already sent a confirmation email to prevent duplicate emails.
     * This happens when beginBookingModificationFlow successfully assigns
     * tables inline and sends the "Changes Confirmed" email.
     */
    skipEmail?: boolean;
  },
) {
  if (options?.skipEmail) {
    console.log(
      '[jobs][booking.updated] Skipping guest update notifications - modification flow already handled email',
      {
        bookingId: payload.current.id,
      },
    );
  }
  await processBookingUpdatedSideEffects(payload, options?.supabase, {
    skipGuestUpdateNotifications: options?.skipEmail,
  });
  return { queued: false } as const;
}

export async function enqueueBookingCancelledSideEffects(
  payload: BookingCancelledSideEffectsPayload,
  options?: { supabase?: SupabaseLike },
) {
  await processBookingCancelledSideEffects(payload, options?.supabase);
  return { queued: false } as const;
}

/**
 * Dedicated function for check-out side effects.
 * Only schedules the review request email - does NOT send booking update emails.
 *
 * This should be called when a booking transitions to 'completed' status via check-out.
 * Unlike enqueueBookingUpdatedSideEffects, this will NOT notify the guest of "changes"
 * because a check-out is an internal operational action, not a booking modification.
 */
export async function enqueueCheckOutSideEffects(
  booking: BookingRecord,
  restaurantId: string,
  options?: { supabase?: SupabaseLike },
): Promise<void> {
  const client = resolveSupabase(options?.supabase);
  const prefs = await fetchRestaurantEmailPrefs(restaurantId, client);

  if (!prefs.sendReviewRequest) return;

  const allowEmail = !SUPPRESS_EMAILS && isValidEmail(booking.customer_email);
  const allowWhatsApp = Boolean(prefs.googleReviewUrl) && hasReviewWhatsAppCandidate(booking);
  if (!allowEmail && !allowWhatsApp) return;

  const timezone = await fetchRestaurantTimezone(restaurantId, client);
  await scheduleReviewJob(booking, restaurantId, {
    allowEmail,
    allowWhatsApp,
    client,
    timezone,
  });
}

export {
  processBookingCreatedSideEffects,
  processBookingUpdatedSideEffects,
  processBookingCancelledSideEffects,
  safeBookingPayload,
};
