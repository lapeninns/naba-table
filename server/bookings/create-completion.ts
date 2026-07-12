import { captureRestaurantServerEvent } from '@/lib/posthog/server';
import { persistBookingWhatsAppConsent } from '@/server/booking/whatsapp-consent';
import { finalizeBookingCreateCommit } from '@/server/bookings/create-finalization';
import { buildBookingCreateHttpResponse } from '@/server/bookings/create-response';

import type { BookingCreatePersistenceResult } from '@/server/bookings/create-persistence';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';
import type { NextResponse } from 'next/server';

type BookingCreateCompletionClient = Parameters<typeof finalizeBookingCreateCommit>[0]['client'];
type BookingCreateCreatedPersistenceResult = Extract<
  BookingCreatePersistenceResult,
  { kind: 'created' }
>;

export type BookingCreateFinalizer = typeof finalizeBookingCreateCommit;
export type BookingCreateHttpResponseBuilder = typeof buildBookingCreateHttpResponse;
export type BookingWhatsAppConsentPersister = typeof persistBookingWhatsAppConsent;

export async function completeBookingCreate({
  autoAssignEnabled,
  client,
  consentPersister = persistBookingWhatsAppConsent,
  finalizer = finalizeBookingCreateCommit,
  inlineAutoAssignTimeoutMs,
  loyaltyPointsAwarded = 0,
  onAutoAssignError,
  onConsentPersistError,
  onInlineAutoAssignError,
  onRecoveryCookieError,
  onSideEffectsError,
  onTokenError,
  persistence,
  recoverySecret,
  recoveryTtlSeconds,
  request,
  requestContext,
  responseBuilder = buildBookingCreateHttpResponse,
  restaurantId,
  useUnifiedValidation,
}: {
  autoAssignEnabled: boolean;
  client: BookingCreateCompletionClient;
  consentPersister?: BookingWhatsAppConsentPersister;
  finalizer?: BookingCreateFinalizer;
  inlineAutoAssignTimeoutMs?: number;
  loyaltyPointsAwarded?: number;
  onAutoAssignError?: (error: unknown) => void;
  onConsentPersistError?: (error: unknown) => void;
  onInlineAutoAssignError?: (error: unknown) => void;
  onRecoveryCookieError?: (error: unknown) => void;
  onSideEffectsError?: (error: unknown) => void;
  onTokenError?: (error: unknown) => void;
  persistence: BookingCreateCreatedPersistenceResult;
  recoverySecret?: string | null;
  recoveryTtlSeconds?: number | null;
  request: BookingCreateRequest;
  requestContext: Pick<BookingCreateRequestContext, 'isOpsWalkIn' | 'opsEmailProvidedHeader'>;
  responseBuilder?: BookingCreateHttpResponseBuilder;
  restaurantId: string;
  useUnifiedValidation: boolean;
}): Promise<NextResponse> {
  const shouldPersistConsent = request.whatsappOptIn && !persistence.booking.whatsapp_opt_in;
  // The booking row is already committed here; a consent write failure must not
  // fail the request, or the guest gets an error for a booking that exists.
  let bookingWithConsent = persistence.booking;
  if (shouldPersistConsent) {
    try {
      bookingWithConsent = await consentPersister({
        actorId: null,
        booking: persistence.booking,
        client,
        optedIn: request.whatsappOptIn,
        restaurantId,
        source: 'guest_reserve',
      });
    } catch (error) {
      onConsentPersistError?.(error);
    }
  }

  const { booking: finalBooking } = await finalizer({
    actor: request.email || persistence.customer.id,
    autoAssignEnabled,
    booking: bookingWithConsent,
    client,
    customer: persistence.customer,
    idempotencyKey: persistence.idempotencyKey,
    inlineAutoAssignTimeoutMs,
    isOpsWalkIn: requestContext.isOpsWalkIn,
    onAutoAssignError,
    onInlineAutoAssignError,
    onSideEffectsError,
    opsEmailProvidedHeader: requestContext.opsEmailProvidedHeader,
    restaurantId,
    reusedExisting: persistence.reusedExisting,
  });

  captureRestaurantServerEvent('booking_created', {
    restaurantId,
    props: {
      bookingId: finalBooking.id,
      source: 'api',
      idempotent: persistence.reusedExisting,
    },
  });

  if (persistence.reusedExisting) {
    captureRestaurantServerEvent('booking_duplicate_prevented', {
      restaurantId,
      props: { bookingId: finalBooking.id, source: 'api' },
    });
  }

  return await responseBuilder({
    booking: finalBooking,
    loyaltyPointsAwarded,
    onRecoveryCookieError,
    onTokenError,
    recoverySecret,
    recoveryTtlSeconds,
    restaurantId,
    reusedExisting: persistence.reusedExisting,
    useUnifiedValidation,
  });
}
