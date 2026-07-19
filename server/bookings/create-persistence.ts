import { NextResponse } from 'next/server';

import { withSundayRoastDetails } from '@/lib/bookings/sunday-roast';
import { runBookingCreateLegacyCapacityCreate } from '@/server/bookings/legacy-capacity-create';
import { runBookingCreateUnifiedValidation } from '@/server/bookings/unified-validation-create';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePrecommitContextResult } from '@/server/bookings/create-precommit-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

type BookingCreatePersistenceClient = Parameters<
  typeof runBookingCreateUnifiedValidation
>[0]['client'] &
  Parameters<typeof runBookingCreateLegacyCapacityCreate>[0]['client'];
type BookingCreatePrecommitContext = Extract<
  BookingCreatePrecommitContextResult,
  { kind: 'continue' }
>;

export type BookingCreateUnifiedValidationRunner = typeof runBookingCreateUnifiedValidation;
export type BookingCreateLegacyCapacityRunner = typeof runBookingCreateLegacyCapacityCreate;

export type BookingCreatePersistenceResult =
  | {
      kind: 'created';
      booking: BookingRecord;
      customer: BookingCreatePrecommitContext['customer'];
      idempotencyKey: string;
      reusedExisting: boolean;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

export async function runBookingCreatePersistence({
  client,
  clientIp,
  legacyCapacityRunner = runBookingCreateLegacyCapacityCreate,
  onStatusError,
  pastTimeBlocking,
  pastTimeGraceMinutes,
  precommit,
  request,
  requestContext,
  restaurantId,
  unifiedValidationRunner = runBookingCreateUnifiedValidation,
  useUnifiedValidation,
}: {
  client: BookingCreatePersistenceClient;
  clientIp: string;
  legacyCapacityRunner?: BookingCreateLegacyCapacityRunner;
  onStatusError?: (error: unknown) => void;
  pastTimeBlocking: boolean;
  pastTimeGraceMinutes: number;
  precommit: BookingCreatePrecommitContext;
  request: BookingCreateRequest;
  requestContext: Pick<
    BookingCreateRequestContext,
    'bookingDetails' | 'bookingSource' | 'clientRequestId' | 'requestSource'
  >;
  restaurantId: string;
  unifiedValidationRunner?: BookingCreateUnifiedValidationRunner;
  useUnifiedValidation: boolean;
}): Promise<BookingCreatePersistenceResult> {
  if (precommit.booking) {
    return {
      kind: 'created',
      booking: precommit.booking,
      customer: precommit.customer,
      idempotencyKey: precommit.idempotencyKey,
      reusedExisting: precommit.reusedExisting,
    };
  }

  const sharedArgs = {
    client,
    request,
    customer: precommit.customer,
    restaurantId,
    bookingType: precommit.bookingType,
    startTime: precommit.startTime,
    endTime: precommit.endTime,
    durationMinutes: precommit.durationMinutes,
    bookingSource: requestContext.bookingSource,
    idempotencyKey: precommit.idempotencyKey,
    clientRequestId: requestContext.clientRequestId,
    bookingDetails: withSundayRoastDetails(requestContext.bookingDetails, request.sundayRoast),
  };

  if (useUnifiedValidation) {
    const unifiedValidationResult = await unifiedValidationRunner({
      ...sharedArgs,
      scheduleTimezone: precommit.scheduleTimezone,
      pastTimeBlocking,
      pastTimeGraceMinutes,
    });

    if (unifiedValidationResult.kind === 'response') {
      return {
        kind: 'response',
        response: NextResponse.json(unifiedValidationResult.body, unifiedValidationResult.init),
      };
    }

    return {
      kind: 'created',
      booking: unifiedValidationResult.booking,
      customer: precommit.customer,
      idempotencyKey: precommit.idempotencyKey,
      reusedExisting: unifiedValidationResult.reusedExisting,
    };
  }

  const legacyCapacityResult = await legacyCapacityRunner({
    ...sharedArgs,
    clientIp,
    requestSource: requestContext.requestSource,
    onStatusError,
  });

  if (legacyCapacityResult.kind === 'response') {
    return legacyCapacityResult;
  }

  return {
    kind: 'created',
    booking: legacyCapacityResult.booking,
    customer: precommit.customer,
    idempotencyKey: precommit.idempotencyKey,
    reusedExisting: legacyCapacityResult.reusedExisting,
  };
}
