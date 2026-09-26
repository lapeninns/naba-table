import { apiError } from '@/lib/api/errors';
import { stringifyError } from '@/server/bookings/error-formatting';
import { buildAuthenticatedMyBookingsHttpResponse } from '@/server/bookings/my-bookings-auth-response';

import type { NextResponse } from 'next/server';

export type BookingsGetMyBookingsResponseBuilder = typeof buildAuthenticatedMyBookingsHttpResponse;
export type BookingsGetLogger = (message: string, detail?: unknown) => void;

const CONTACT_LOOKUP_REMOVED_MESSAGE =
  'Looking up bookings by email or phone is no longer available. Use the link in your booking email, or request a new one.';

/**
 * GET /api/bookings
 *
 * - `?me=1`: the signed-in guest's own bookings (bound to their account).
 * - anything else: 410 `CONTACT_LOOKUP_REMOVED`. The contact lookup used to
 *   list bookings for an email + phone pair, which let anyone who knew a
 *   guest's contact details read and then manage their bookings. It is gone;
 *   a lost link is re-sent to the stored inbox through
 *   POST /api/bookings/lookup-email instead. No query runs on this path.
 *
 * The remaining parameters are accepted for call-site compatibility with the
 * route (owned by the booking-create stream) and are ignored.
 */
export async function buildBookingsGetHttpResponse({
  logger = console.error,
  myBookingsResponseBuilder = buildAuthenticatedMyBookingsHttpResponse,
  searchParams,
}: {
  searchParams: URLSearchParams;
  logger?: BookingsGetLogger;
  myBookingsResponseBuilder?: BookingsGetMyBookingsResponseBuilder;
  /** @deprecated ignored: the contact lookup was removed. */
  clientIp?: string;
  /** @deprecated ignored: `sr_access` is no longer read. */
  cookieAccessToken?: string | null;
  /** @deprecated ignored: the contact lookup was removed. */
  guestLookupPepper?: string | null;
  /** @deprecated ignored: the contact lookup was removed. */
  guestLookupPolicyEnabled?: boolean;
  /** @deprecated ignored: the contact lookup was removed. */
  headers?: Headers;
  /** @deprecated ignored: `sr2` tokens are no longer accepted. */
  sessionRecoverySecret?: string | null;
}): Promise<NextResponse> {
  if (searchParams.get('me') !== '1') {
    const response = apiError(410, 'CONTACT_LOOKUP_REMOVED', CONTACT_LOOKUP_REMOVED_MESSAGE);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  try {
    return await myBookingsResponseBuilder({
      onPageFetchError: (error) => {
        logger('[bookings][GET][me]', stringifyError(error));
      },
      searchParams,
    });
  } catch (error: unknown) {
    logger('[bookings][GET]', stringifyError(error));
    return apiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Try again.');
  }
}
