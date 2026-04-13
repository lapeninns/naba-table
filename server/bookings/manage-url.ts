import { env } from '@/lib/env';
import { createSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';

const bookingSiteUrl = (env.raw.NEXT_PUBLIC_SITE_URL ?? env.raw.SITE_URL ?? env.app.url).replace(
  /\/+$/,
  '',
);

type ManageUrlBooking = {
  id: string;
  restaurant_id: string | null | undefined;
  customer_email: string | null | undefined;
  customer_phone: string | null | undefined;
};

export function buildBookingManageUrl(booking: ManageUrlBooking): string {
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
