import { NextResponse } from 'next/server';

import { resolveBookingCreateConfirmationToken } from '@/server/bookings/confirmation-token';
import { buildBookingCreateSuccessResponse } from '@/server/bookings/create-success-response';
import {
  buildBookingConfirmationCookie,
  buildBookingSessionRecoveryAccessCookie,
} from '@/server/bookings/response-cookies';

import type { BookingRecord } from '@/server/bookings';

export type BookingCreateConfirmationTokenResolver = typeof resolveBookingCreateConfirmationToken;
export type BookingCreateResponseBuilder = typeof buildBookingCreateSuccessResponse;
export type BookingCreateConfirmationCookieBuilder = typeof buildBookingConfirmationCookie;
export type BookingCreateRecoveryCookieBuilder = typeof buildBookingSessionRecoveryAccessCookie;

export async function buildBookingCreateHttpResponse({
  booking,
  confirmationCookieBuilder = buildBookingConfirmationCookie,
  confirmationTokenResolver = resolveBookingCreateConfirmationToken,
  loyaltyPointsAwarded,
  onRecoveryCookieError,
  onTokenError,
  recoveryCookieBuilder = buildBookingSessionRecoveryAccessCookie,
  recoverySecret,
  recoveryTtlSeconds,
  restaurantId,
  responseBuilder = buildBookingCreateSuccessResponse,
  reusedExisting,
  useUnifiedValidation,
}: {
  booking: BookingRecord;
  confirmationCookieBuilder?: BookingCreateConfirmationCookieBuilder;
  confirmationTokenResolver?: BookingCreateConfirmationTokenResolver;
  loyaltyPointsAwarded: number;
  onRecoveryCookieError?: (error: unknown) => void;
  onTokenError?: (error: unknown) => void;
  recoveryCookieBuilder?: BookingCreateRecoveryCookieBuilder;
  recoverySecret?: string | null;
  recoveryTtlSeconds?: number | null;
  restaurantId: string;
  responseBuilder?: BookingCreateResponseBuilder;
  reusedExisting: boolean;
  useUnifiedValidation: boolean;
}): Promise<NextResponse> {
  let confirmationToken: string | null = null;
  try {
    confirmationToken = await confirmationTokenResolver({
      booking,
      reusedExisting,
    });
  } catch (error) {
    onTokenError?.(error);
    confirmationToken = null;
  }

  const response = responseBuilder({
    booking,
    loyaltyPointsAwarded,
    duplicate: reusedExisting,
    useUnifiedValidation,
  });

  const nextResponse = NextResponse.json(response.body, response.init);
  const confirmationCookie = confirmationCookieBuilder(confirmationToken);
  if (confirmationCookie) {
    try {
      nextResponse.cookies.set(
        confirmationCookie.name,
        confirmationCookie.value,
        confirmationCookie.options,
      );
    } catch {
      // Non-fatal; continue without cookie.
    }
  }

  try {
    const recoveryCookie = recoveryCookieBuilder({
      secret: recoverySecret,
      ttlSeconds: recoveryTtlSeconds,
      restaurantId,
      email: booking.customer_email,
      phone: booking.customer_phone,
    });
    if (recoveryCookie) {
      nextResponse.cookies.set(recoveryCookie.name, recoveryCookie.value, recoveryCookie.options);
    }
  } catch (error) {
    onRecoveryCookieError?.(error);
  }

  return nextResponse;
}
