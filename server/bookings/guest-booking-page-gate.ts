import {
  resolveGuestBookingAccessForPage,
  type GuestPageAccessResult,
} from '@/server/bookings/guest-booking-access';
import { isUuid } from '@/server/security/booking-access-token';

export type BookingAccessDeniedReason = Exclude<
  Extract<GuestPageAccessResult, { status: 'denied' }>['reason'],
  'unauthenticated'
>;

export type GuestBookingPageSearchParams = {
  token?: string | string[];
  access_token?: string | string[];
  accessToken?: string | string[];
};

export type GuestBookingPageGate =
  | { kind: 'redirect'; location: string }
  | { kind: 'sign_in' }
  | { kind: 'denied'; reason: BookingAccessDeniedReason; isAuthenticated: boolean }
  | { kind: 'allowed' };

function first(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.length > 0 ? candidate : null;
}

/**
 * Access decision for the guest booking pages (§8.3), shared by the manage
 * page (/bookings/<id>, /guest/bookings/<id>) and the receipt page:
 * - `?access_token=` is redeemed through /bookings/recover (back to this page);
 * - legacy `?token=` links go to the deprecation page;
 * - otherwise the booking cookie or an owning session must grant access, with
 *   the same fingerprint check as the API, so a revoked cookie never renders
 *   a manageable page.
 */
export async function resolveGuestBookingPageGate(params: {
  bookingId: string;
  ownPath: string;
  searchParams: GuestBookingPageSearchParams;
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<GuestBookingPageGate> {
  const accessToken =
    first(params.searchParams.access_token) ?? first(params.searchParams.accessToken);
  if (accessToken) {
    const recoverUrl = new URLSearchParams({ access_token: accessToken, next: params.ownPath });
    return { kind: 'redirect', location: `/bookings/recover?${recoverUrl.toString()}` };
  }

  if (first(params.searchParams.token)) {
    return {
      kind: 'redirect',
      location: '/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED',
    };
  }

  if (!isUuid(params.bookingId)) {
    return { kind: 'denied', reason: 'not_found', isAuthenticated: false };
  }

  const access = await resolveGuestBookingAccessForPage(params.cookies, params.bookingId);
  if (access.status === 'ok') {
    return { kind: 'allowed' };
  }
  if (access.reason === 'unauthenticated') {
    return { kind: 'sign_in' };
  }
  return {
    kind: 'denied',
    reason: access.reason,
    isAuthenticated: access.reason === 'not_found',
  };
}
