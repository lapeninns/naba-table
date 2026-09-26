import { after, NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, rateLimited, validationError } from '@/lib/api/errors';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { fetchBookingsForContact } from '@/server/bookings';
import { consumeContactThrottle, lookupContactKey } from '@/server/bookings/lookup-contact-key';
import { isManageLinkEligibleBooking } from '@/server/bookings/manage-link-eligibility';
import { resolveBookingRestaurantId } from '@/server/bookings/restaurant-resolution';
import { normalizeEmail } from '@/server/customers';
import { recordObservabilityEvent } from '@/server/observability';
import { enqueueEmailJob } from '@/server/queue/email';
import { validateCsrfToken } from '@/server/security/csrf';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { extractClientIp, rateLimitIpKey } from '@/server/security/request';
import { verifyTurnstileToken } from '@/server/security/turnstile';
import { getTenantServiceSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

/**
 * POST /api/bookings/lookup-email — "email me a link to my booking" (§7).
 *
 * The response is always the same neutral 202, whether or not the email has
 * bookings, so it cannot be used to discover who booked where. Matching
 * bookings get a `manage_link` email to the address stored on the booking;
 * the request's email is only a lookup key, never a recipient.
 */

const LOOKUP_EMAIL_ACCEPTED_MESSAGE =
  "If that email has an upcoming booking at this venue, we'll send a link to manage it within a few minutes.";
const LOOKUP_EMAIL_IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 } as const;
const LOOKUP_EMAIL_MAX_BOOKINGS = 5;
const JOB_BUCKET_MS = 15 * 60 * 1000;
const TURNSTILE_ACTION = 'booking_lookup_email';

const lookupEmailRequestSchema = z
  .object({
    restaurantId: z.string().uuid().optional(),
    restaurantSlug: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().max(320).email(),
    turnstileToken: z.string().trim().min(1).max(4096).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.restaurantId) !== Boolean(value.restaurantSlug), {
    message: 'Choose a venue.',
    path: ['restaurantId'],
  });

export type LookupEmailDeps = {
  now: () => Date;
  secret: string | null;
  turnstileEnabled: boolean;
  consumeRateLimit: typeof consumeRateLimit;
  consumeContactThrottle: typeof consumeContactThrottle;
  verifyTurnstile: typeof verifyTurnstileToken;
  resolveRestaurantId: typeof resolveBookingRestaurantId;
  fetchBookings: (restaurantId: string, email: string) => Promise<BookingRecord[]>;
  enqueueEmail: typeof enqueueEmailJob;
  recordEvent: typeof recordObservabilityEvent;
  runAfter: (task: () => Promise<void>) => void;
};

function defaultDeps(): LookupEmailDeps {
  return {
    now: () => new Date(),
    secret: env.security.sessionRecoveryAccessTokenSecret,
    turnstileEnabled: Boolean(env.security.turnstileSecretKey),
    consumeRateLimit,
    consumeContactThrottle,
    verifyTurnstile: verifyTurnstileToken,
    resolveRestaurantId: resolveBookingRestaurantId,
    fetchBookings: (restaurantId, email) =>
      fetchBookingsForContact(
        getTenantServiceSupabaseClient(restaurantId),
        restaurantId,
        email,
        '',
      ),
    enqueueEmail: enqueueEmailJob,
    recordEvent: recordObservabilityEvent,
    runAfter: (task) => after(task),
  };
}

function acceptedResponse(): NextResponse {
  return NextResponse.json(
    { status: 'accepted', message: LOOKUP_EMAIL_ACCEPTED_MESSAGE },
    { status: 202, headers: { 'Cache-Control': 'no-store' } },
  );
}

function startMs(booking: BookingRecord): number {
  const parsed = booking.start_at ? new Date(booking.start_at).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/** Picks the bookings to email: stored email matches, still eligible, soonest first. */
export function selectManageLinkBookings(
  bookings: BookingRecord[],
  email: string,
  now: Date,
): BookingRecord[] {
  const requested = normalizeEmail(email);
  return bookings
    .filter((booking) => normalizeEmail(booking.customer_email) === requested)
    .filter((booking) => isManageLinkEligibleBooking(booking, now))
    .sort((a, b) => startMs(a) - startMs(b))
    .slice(0, LOOKUP_EMAIL_MAX_BOOKINGS);
}

export async function buildLookupEmailHttpResponse(
  req: NextRequest,
  overrides: Partial<LookupEmailDeps> = {},
): Promise<NextResponse> {
  const deps: LookupEmailDeps = { ...defaultDeps(), ...overrides };

  if (!validateCsrfToken(req)) {
    return apiError(403, 'CSRF_INVALID', 'Refresh the page and try again.');
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiError(400, 'INVALID_JSON', 'Invalid request.');
  }

  const parsed = lookupEmailRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const input = parsed.data;

  // Links cannot be minted without the token secret. Say so instead of the
  // neutral 202, which would tell the guest to wait for an email that never
  // comes. This is global configuration, so it reveals nothing about contacts.
  if (!deps.secret) {
    return apiError(
      503,
      'BOOKING_LINKS_UNAVAILABLE',
      'Booking links are temporarily unavailable. Contact the venue to manage your booking.',
    );
  }

  const clientIp = extractClientIp(req);
  // Per IPv4 address or IPv6 /64. With no usable IP the IP charge is skipped
  // rather than pooled into one global bucket that any client could exhaust
  // for everyone; Turnstile and the per-contact throttle below still apply,
  // and the email only ever goes to the address stored on the booking.
  const ipKey = rateLimitIpKey(clientIp);
  if (ipKey) {
    try {
      const ipLimit = await deps.consumeRateLimit({
        identifier: `bookings:lookup-email:ip:${ipKey}`,
        limit: LOOKUP_EMAIL_IP_LIMIT.limit,
        windowMs: LOOKUP_EMAIL_IP_LIMIT.windowMs,
      });
      if (!ipLimit.ok) {
        return rateLimited(Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000)));
      }
    } catch {
      return apiError(
        503,
        'RATE_LIMIT_UNAVAILABLE',
        'Service temporarily unavailable. Try again.',
        {
          retryable: true,
        },
      );
    }
  }

  if (deps.turnstileEnabled) {
    const challenge = input.turnstileToken
      ? await deps.verifyTurnstile({
          token: input.turnstileToken,
          remoteIp: clientIp,
          expectedAction: TURNSTILE_ACTION,
        })
      : null;
    if (!challenge?.ok) {
      return apiError(400, 'CHALLENGE_FAILED', 'Please complete the check and try again.');
    }
  }

  const restaurant = await deps.resolveRestaurantId({
    restaurantId: input.restaurantId ?? null,
    restaurantSlug: input.restaurantSlug ?? null,
  });
  if (!restaurant.ok || restaurant.source === 'default') {
    return restaurant.ok || restaurant.status === 404
      ? apiError(404, 'RESTAURANT_NOT_FOUND', 'We couldn’t find that venue.')
      : apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Try again.');
  }
  const restaurantId = restaurant.restaurantId;

  // From here on every outcome is the same neutral 202.
  const throttle = await deps.consumeContactThrottle(
    lookupContactKey({ restaurantId, email: input.email, secret: deps.secret }),
  );

  const now = deps.now();
  deps.runAfter(async () => {
    if (!throttle.allowed) {
      return;
    }
    try {
      const bookings = selectManageLinkBookings(
        await deps.fetchBookings(restaurantId, input.email),
        input.email,
        now,
      );
      const bucket = Math.floor(now.getTime() / JOB_BUCKET_MS);
      for (const booking of bookings) {
        await deps.enqueueEmail(
          { bookingId: booking.id, restaurantId, type: 'manage_link' },
          { jobId: `manage_link:${booking.id}:${bucket}` },
        );
      }
      await deps.recordEvent({
        source: 'api.bookings',
        eventType: 'booking_lookup_email.requested',
        severity: 'info',
        context: { restaurantId, matched: bookings.length > 0, count: bookings.length },
        restaurantId,
      });
    } catch (error) {
      logger.warn('bookings.lookup_email.enqueue_failed', {
        restaurantId,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  });

  return acceptedResponse();
}
