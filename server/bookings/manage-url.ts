import { env } from '@/lib/env';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { createBookingAccessToken, isUuid } from '@/server/security/booking-access-token';

export type ManageUrlBooking = {
  id: string;
  restaurant_id: string | null | undefined;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
  start_at?: string | null;
  end_at?: string | null;
  booking_date?: string | null;
};

function normalizeOrigin(candidate: string | null | undefined): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed || trimmed === '/') {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function rootOriginFromAppOrigin(candidate: string | null | undefined): string | null {
  const normalized = normalizeOrigin(candidate);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname === 'app.localhost') {
      url.hostname = 'localhost';
      return url.toString().replace(/\/+$/, '');
    }

    if (url.hostname.startsWith('app.')) {
      url.hostname = url.hostname.slice('app.'.length);
      return url.toString().replace(/\/+$/, '');
    }

    return normalized;
  } catch {
    return null;
  }
}

function resolveBookingSiteUrl(): string {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeOrigin(process.env.SITE_URL) ??
    rootOriginFromAppOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(getCanonicalSiteUrl()) ??
    'https://nabatable.com'
  );
}

function buildRecoverErrorUrl(bookingSiteUrl: string, code: string): string {
  const errorUrl = new URL(`${bookingSiteUrl}/bookings/recover/error`);
  errorUrl.searchParams.set('code', code);
  return errorUrl.toString();
}

export type BookingManageLink = { url: string; expiresAt: Date };

/**
 * A booking-scoped manage link: `${site}/bookings/recover?access_token=<bk1>`
 * (no `next`; /bookings/recover sends the guest to `/bookings/<id>`). The
 * token grants access to this booking only and dies when the booking's
 * contact details change. `null` when no capability can be minted (secret
 * missing, preview booking, or no contact details).
 */
export function buildBookingManageLink(
  booking: ManageUrlBooking,
  options: { now?: Date } = {},
): BookingManageLink | null {
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  if (!secret) {
    return null;
  }

  const minted = createBookingAccessToken({
    booking,
    secret,
    source: 'link',
    now: options.now,
  });
  if (!minted) {
    return null;
  }

  const recoverUrl = new URL(`${resolveBookingSiteUrl()}/bookings/recover`);
  recoverUrl.searchParams.set('access_token', minted.token);
  return { url: recoverUrl.toString(), expiresAt: minted.expiresAt };
}

/**
 * The manage link as a URL string for message templates. Never throws: when
 * no link can be minted it returns the recover error page with a reason code,
 * and email previews (non-uuid ids) get the self-service lost-link page.
 */
export function buildBookingManageUrl(booking: ManageUrlBooking): string {
  const bookingSiteUrl = resolveBookingSiteUrl();

  if (!isUuid(booking.id)) {
    return `${bookingSiteUrl}/bookings/find`;
  }

  if (!env.security.sessionRecoveryAccessTokenSecret) {
    return buildRecoverErrorUrl(bookingSiteUrl, 'ACCESS_TOKEN_NOT_CONFIGURED');
  }

  try {
    const link = buildBookingManageLink(booking);
    return link ? link.url : buildRecoverErrorUrl(bookingSiteUrl, 'MISSING_ACCESS_TOKEN');
  } catch {
    return buildRecoverErrorUrl(bookingSiteUrl, 'INVALID_ACCESS_TOKEN');
  }
}

/**
 * The booking page without any capability. It opens only for a browser that
 * already holds the booking cookie or an owning session. Used where the link
 * may reach someone other than the guest (staff emails, calendar files).
 */
export function buildBookingPlainUrl(booking: Pick<ManageUrlBooking, 'id'>): string {
  const bookingSiteUrl = resolveBookingSiteUrl();
  if (!isUuid(booking.id)) {
    return `${bookingSiteUrl}/bookings/find`;
  }
  return `${bookingSiteUrl}/bookings/${booking.id}`;
}
