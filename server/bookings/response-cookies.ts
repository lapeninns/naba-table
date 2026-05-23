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
