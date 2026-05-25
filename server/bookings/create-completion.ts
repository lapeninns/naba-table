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

export async function completeBookingCreate({
  autoAssignEnabled,
  client,
  finalizer = finalizeBookingCreateCommit,
  inlineAutoAssignTimeoutMs,
  loyaltyPointsAwarded = 0,
  onAutoAssignError,
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
  finalizer?: BookingCreateFinalizer;
  inlineAutoAssignTimeoutMs?: number;
  loyaltyPointsAwarded?: number;
  onAutoAssignError?: (error: unknown) => void;
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
  const { booking: finalBooking } = await finalizer({
    actor: request.email,
    autoAssignEnabled,
    booking: persistence.booking,
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
