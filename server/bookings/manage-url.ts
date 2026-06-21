import { env } from '@/lib/env';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

type ManageUrlBooking = {
  id: string;
  restaurant_id: string | null | undefined;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
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

export function buildBookingManageUrl(booking: ManageUrlBooking): string {
  const bookingSiteUrl = resolveBookingSiteUrl();
  const secret = env.security.sessionRecoveryAccessTokenSecret;
  const ttlSeconds = env.security.sessionRecoveryAccessTokenTtlSeconds;
  const restaurantId = booking.restaurant_id;
  const email = booking.customer_email;
  const phone = booking.customer_phone;
  const hasEmail = typeof email === 'string' && email.trim().length > 0;
  const hasPhone = typeof phone === 'string' && phone.trim().length > 0;

  const buildRecoverErrorUrl = (code: string) => {
    const errorUrl = new URL(`${bookingSiteUrl}/bookings/recover/error`);
    errorUrl.searchParams.set('code', code);
    return errorUrl.toString();
  };

  if (!secret) {
    return buildRecoverErrorUrl('ACCESS_TOKEN_NOT_CONFIGURED');
  }

  if (!restaurantId || (!hasEmail && !hasPhone)) {
    return buildRecoverErrorUrl('MISSING_ACCESS_TOKEN');
  }

  try {
    const accessToken = createSessionRecoveryAccessToken({
      restaurantId,
      email,
      phone,
      secret,
      ttlSeconds,
    });

    const recoverUrl = new URL(`${bookingSiteUrl}/bookings/recover`);
    recoverUrl.searchParams.set('access_token', accessToken);
    recoverUrl.searchParams.set('next', `/bookings/${booking.id}`);
    return recoverUrl.toString();
  } catch {
    return buildRecoverErrorUrl('INVALID_ACCESS_TOKEN');
  }
}
