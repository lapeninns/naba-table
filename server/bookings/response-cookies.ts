import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

type BookingResponseCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: true;
  path: string;
  maxAge: number;
};

export type BookingResponseCookie = {
  name: 'sr_confirm' | 'sr_access';
  value: string;
  options: BookingResponseCookieOptions;
};

/**
 * @deprecated Retired with /api/bookings/confirm. Still called by the create
 * response until S1b switches it to the booking access cookie; nothing reads
 * `sr_confirm` any more.
 */
export function buildBookingConfirmationCookie(
  confirmationToken: string | null,
): BookingResponseCookie | null {
  if (!confirmationToken) {
    return null;
  }

  return {
    name: 'sr_confirm',
    value: confirmationToken,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/api/bookings/confirm',
      maxAge: 60 * 60,
    },
  };
}

/**
 * @deprecated Contact-scoped `sr2` cookie. Nothing reads `sr_access` any more
 * (it is cleared on guest responses); S1b replaces this call in the create
 * response with `mintBookingAccessGrant` + `setBookingAccessCookie`.
 */
export function buildBookingSessionRecoveryAccessCookie({
  secret,
  ttlSeconds,
  restaurantId,
  email,
  phone,
}: {
  secret: string | null | undefined;
  ttlSeconds: number | null | undefined;
  restaurantId: string;
  email: string | null;
  phone: string | null;
}): BookingResponseCookie | null {
  if (!secret) {
    return null;
  }

  const resolvedTtlSeconds = ttlSeconds ?? 900;
  const accessToken = createSessionRecoveryAccessToken({
    restaurantId,
    email,
    phone,
    secret,
    ttlSeconds: resolvedTtlSeconds,
  });

  return {
    name: 'sr_access',
    value: accessToken,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: resolvedTtlSeconds,
    },
  };
}
