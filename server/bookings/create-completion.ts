import { captureRestaurantServerEvent } from '@/lib/posthog/server';
import { persistBookingWhatsAppConsent } from '@/server/booking/whatsapp-consent';
import { finalizeBookingCreateCommit } from '@/server/bookings/create-finalization';
import { buildBookingCreateHttpResponse } from '@/server/bookings/create-response';
import { isCreatorKeyReplayEligible } from '@/server/bookings/idempotency';

import type { BookingCreatePersistenceResult } from '@/server/bookings/create-persistence';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateCookieRequest } from '@/server/bookings/create-response';
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
  accessSecret,
  autoAssignEnabled,
  client,
  consentPersister = persistBookingWhatsAppConsent,
  cookieRequest,
  finalizer = finalizeBookingCreateCommit,
  inlineAutoAssignTimeoutMs,
  loyaltyPointsAwarded = 0,
  now = Date.now,
  onAutoAssignError,
  onConsentPersistError,
  onInlineAutoAssignError,
  onSideEffectsError,
  persistence,
  request,
  requestContext,
  responseBuilder = buildBookingCreateHttpResponse,
  restaurantId,
  useUnifiedValidation,
}: {
  /** bk1 key for the creator cookie; `null` issues no capability. */
  accessSecret: string | null | undefined;
  autoAssignEnabled: boolean;
  client: BookingCreateCompletionClient;
  consentPersister?: BookingWhatsAppConsentPersister;
  cookieRequest: BookingCreateCookieRequest;
  finalizer?: BookingCreateFinalizer;
  inlineAutoAssignTimeoutMs?: number;
  loyaltyPointsAwarded?: number;
  now?: () => number;
  onAutoAssignError?: (error: unknown) => void;
  onConsentPersistError?: (error: unknown) => void;
  onInlineAutoAssignError?: (error: unknown) => void;
  onSideEffectsError?: (error: unknown) => void;
  persistence: BookingCreateCreatedPersistenceResult;
  request: BookingCreateRequest;
  requestContext: Pick<
    BookingCreateRequestContext,
    'headerIdempotencyKey' | 'isOpsWalkIn' | 'opsEmailProvidedHeader'
  >;
  responseBuilder?: BookingCreateHttpResponseBuilder;
  restaurantId: string;
  useUnifiedValidation: boolean;
}): Promise<NextResponse> {
  // Guest-auth §4.2: an insert always acts for the creator; any other origin only when it
  // replays the client's own uuid key within the replay window. Decided up front so a
  // caller who only knows the contact details and slot cannot change the matched booking.
  const creatorCapabilityEligible =
    persistence.createOrigin === 'inserted' ||
    isCreatorKeyReplayEligible({
      booking: persistence.booking,
      headerIdempotencyKey: requestContext.headerIdempotencyKey,
      now: now(),
    });

  const shouldPersistConsent =
    request.whatsappOptIn && creatorCapabilityEligible && !persistence.booking.whatsapp_opt_in;
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

  // Not eligible: 409 BOOKING_NOT_COMPLETED with no DTO, plus the throttled lost-link email.
  return await responseBuilder({
    accessSecret,
    booking: finalBooking,
    contactEmail: request.email,
    cookieRequest,
    createOrigin: persistence.createOrigin,
    creatorCapabilityEligible,
    loyaltyPointsAwarded,
    now: () => new Date(now()),
    restaurantId,
    useUnifiedValidation,
  });
}
