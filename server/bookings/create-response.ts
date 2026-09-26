import { NextResponse } from 'next/server';

import { conflict } from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { buildBookingCreateSuccessResponse } from '@/server/bookings/create-success-response';
import {
  clearLegacyGuestCookies,
  mintBookingAccessGrant,
  setBookingAccessCookie,
} from '@/server/bookings/guest-booking-access';
import { type BookingCreateOrigin } from '@/server/bookings/idempotency';
import { consumeContactThrottle, lookupContactKey } from '@/server/bookings/lookup-contact-key';
import { isManageLinkEligibleBooking } from '@/server/bookings/manage-link-eligibility';
import { enqueueEmailJob } from '@/server/queue/email';

import type { BookingRecord } from '@/server/bookings';
import type { NextRequest } from 'next/server';

export type BookingCreateResponseBuilder = typeof buildBookingCreateSuccessResponse;
export type BookingCreateGrantMinter = typeof mintBookingAccessGrant;
export type BookingCreateContactThrottle = typeof consumeContactThrottle;
export type BookingCreateManageLinkEnqueuer = typeof enqueueEmailJob;

/** The request fields the creator cookie needs (existing booking cookies, protocol). */
export type BookingCreateCookieRequest = Pick<NextRequest, 'headers' | 'nextUrl' | 'cookies'>;

export const BOOKING_NOT_COMPLETED_CODE = 'BOOKING_NOT_COMPLETED';
/**
 * Guest-auth design §4.2. Deliberately neutral: identical whether the matched booking is
 * active, cancelled or past, and it never names the booking or its contact.
 */
export const BOOKING_NOT_COMPLETED_MESSAGE =
  "We couldn't complete this booking. If you've already booked this time, check your email for your confirmation and a link to manage it.";

/** Same 15-minute bucket as POST /api/bookings/lookup-email, so the two share job ids. */
const MANAGE_LINK_JOB_BUCKET_MS = 15 * 60 * 1000;

/**
 * Builds the POST /api/bookings answer for a committed (or matched) booking.
 *
 * - **Creator-eligible** (an insert, or a fresh replay of the client's own uuid
 *   `Idempotency-Key`): the booking body (201; a replay returns the same body) plus the
 *   booking-scoped `bk1` creator cookie `__Host-nt_bk.<id>`.
 * - **Not eligible** (a booking matched by the derived key or by slot signature, or a stale
 *   or foreign-key replay): `409 BOOKING_NOT_COMPLETED` with neutral copy, no cookie and no
 *   booking DTO. It consumes the per-contact lost-link throttle shared with
 *   `/api/bookings/lookup-email` and, under the limit, emails a manage link to the address
 *   stored on the booking, so the real owner can still reach it.
 *
 * Every answer clears the retired `sr_access`/`sr_confirm` cookies. The cookie helpers append
 * raw Set-Cookie headers, so nothing here calls `res.cookies.set` afterwards.
 */
export async function buildBookingCreateHttpResponse({
  accessSecret,
  booking,
  contactEmail,
  contactThrottle = consumeContactThrottle,
  cookieRequest,
  createOrigin,
  creatorCapabilityEligible,
  grantMinter = mintBookingAccessGrant,
  loyaltyPointsAwarded,
  manageLinkEnqueuer = enqueueEmailJob,
  now = () => new Date(),
  restaurantId,
  responseBuilder = buildBookingCreateSuccessResponse,
  useUnifiedValidation,
}: {
  /** bk1 key (`SESSION_RECOVERY_ACCESS_TOKEN_SECRET`); without it no capability is issued. */
  accessSecret: string | null | undefined;
  booking: BookingRecord;
  /** The email the request was made with; keys the per-contact throttle. */
  contactEmail: string | null | undefined;
  contactThrottle?: BookingCreateContactThrottle;
  cookieRequest: BookingCreateCookieRequest;
  /** How the booking was resolved; kept for observability and callers' logs. */
  createOrigin: BookingCreateOrigin;
  /** Guest-auth §4.2: inserted, or a fresh replay of the client's own uuid key. */
  creatorCapabilityEligible: boolean;
  grantMinter?: BookingCreateGrantMinter;
  loyaltyPointsAwarded: number;
  manageLinkEnqueuer?: BookingCreateManageLinkEnqueuer;
  now?: () => Date;
  restaurantId: string;
  responseBuilder?: BookingCreateResponseBuilder;
  useUnifiedValidation: boolean;
}): Promise<NextResponse> {
  if (!creatorCapabilityEligible) {
    await sendLostLinkForMatchedBooking({
      accessSecret,
      booking,
      contactEmail,
      contactThrottle,
      createOrigin,
      manageLinkEnqueuer,
      now: now(),
      restaurantId,
    });

    const refused = conflict(BOOKING_NOT_COMPLETED_CODE, BOOKING_NOT_COMPLETED_MESSAGE, {
      retryable: false,
    });
    refused.headers.set('Cache-Control', 'no-store');
    clearLegacyGuestCookies(refused);
    return refused;
  }

  // An eligible replay answers exactly like the original insert (same body, 201).
  const response = responseBuilder({
    booking,
    loyaltyPointsAwarded,
    duplicate: false,
    useUnifiedValidation,
  });
  const nextResponse = NextResponse.json(response.body, response.init);

  if (accessSecret) {
    try {
      const issuedAt = now();
      const grant = grantMinter({
        booking,
        source: 'create',
        secret: accessSecret,
        now: issuedAt,
      });
      if (grant) {
        setBookingAccessCookie(cookieRequest, nextResponse, grant, {
          secret: accessSecret,
          now: issuedAt,
        });
      }
    } catch (error) {
      // The booking exists; a cookie failure must not fail the create. The guest can still
      // open it from the confirmation email.
      logger.warn('bookings.create.creator_cookie_failed', {
        bookingId: booking.id,
        restaurantId,
        errorName: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  clearLegacyGuestCookies(nextResponse);
  return nextResponse;
}

async function sendLostLinkForMatchedBooking(params: {
  accessSecret: string | null | undefined;
  booking: BookingRecord;
  contactEmail: string | null | undefined;
  contactThrottle: BookingCreateContactThrottle;
  createOrigin: BookingCreateOrigin;
  manageLinkEnqueuer: BookingCreateManageLinkEnqueuer;
  now: Date;
  restaurantId: string;
}): Promise<void> {
  const email = params.contactEmail?.trim();
  // A phone-only request has no email key; lost-link SMS is out of scope (design §7).
  if (!params.accessSecret || !email) {
    logger.info('bookings.create.not_completed', {
      restaurantId: params.restaurantId,
      createOrigin: params.createOrigin,
      lostLink: 'skipped',
    });
    return;
  }

  try {
    const throttle = await params.contactThrottle(
      lookupContactKey({ restaurantId: params.restaurantId, email, secret: params.accessSecret }),
    );
    const send = throttle.allowed && isManageLinkEligibleBooking(params.booking, params.now);
    if (send) {
      const bucket = Math.floor(params.now.getTime() / MANAGE_LINK_JOB_BUCKET_MS);
      await params.manageLinkEnqueuer(
        { bookingId: params.booking.id, restaurantId: params.restaurantId, type: 'manage_link' },
        { jobId: `manage_link:${params.booking.id}:${bucket}` },
      );
    }
    logger.info('bookings.create.not_completed', {
      restaurantId: params.restaurantId,
      createOrigin: params.createOrigin,
      lostLink: send ? 'enqueued' : throttle.allowed ? 'ineligible' : 'throttled',
    });
  } catch (error) {
    logger.warn('bookings.create.lost_link_failed', {
      restaurantId: params.restaurantId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}
