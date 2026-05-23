import { NextResponse } from 'next/server';

import { stringifyError } from '@/server/bookings/error-formatting';
import { buildGuestLookupHttpResponse } from '@/server/bookings/guest-lookup-response';
import { buildAuthenticatedMyBookingsHttpResponse } from '@/server/bookings/my-bookings-auth-response';

export type BookingsGetMyBookingsResponseBuilder = typeof buildAuthenticatedMyBookingsHttpResponse;
export type BookingsGetGuestLookupResponseBuilder = typeof buildGuestLookupHttpResponse;
export type BookingsGetLogger = (message: string, detail?: unknown) => void;

export async function buildBookingsGetHttpResponse({
  clientIp,
  cookieAccessToken,
  guestLookupPepper,
  guestLookupPolicyEnabled,
  guestLookupResponseBuilder = buildGuestLookupHttpResponse,
  headers,
  logger = console.error,
  myBookingsResponseBuilder = buildAuthenticatedMyBookingsHttpResponse,
  searchParams,
  sessionRecoverySecret,
}: {
  clientIp: string;
  cookieAccessToken?: string | null;
  guestLookupPepper?: string | null;
  guestLookupPolicyEnabled: boolean;
  guestLookupResponseBuilder?: BookingsGetGuestLookupResponseBuilder;
  headers: Headers;
  logger?: BookingsGetLogger;
  myBookingsResponseBuilder?: BookingsGetMyBookingsResponseBuilder;
  searchParams: URLSearchParams;
  sessionRecoverySecret?: string | null;
}): Promise<NextResponse> {
  try {
    const requestSource = 'api.bookings';
    const meParam = searchParams.get('me');

    if (meParam === '1') {
      return await myBookingsResponseBuilder({
        onPageFetchError: (error) => {
          logger('[bookings][GET][me]', error);
        },
        searchParams,
      });
    }

    return await guestLookupResponseBuilder({
      clientIp,
      cookieAccessToken,
      guestLookupPepper,
      guestLookupPolicyEnabled,
      onPolicyLog: (policyLog) => {
        if (policyLog.kind === 'rpc_failed') {
          logger('[bookings][GET][guest-lookup] rpc failed', policyLog.message);
        }

        if (policyLog.kind === 'unexpected_error') {
          logger('[bookings][GET][guest-lookup] unexpected error', policyLog.message);
        }
      },
      requestHeaders: headers,
      requestSource,
      searchParams,
      sessionRecoverySecret,
    });
  } catch (error: unknown) {
    logger('[bookings][GET]', stringifyError(error));
    return NextResponse.json({ error: 'Unable to fetch bookings' }, { status: 500 });
  }
}
