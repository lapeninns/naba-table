import {
  resolveBookingCreateOrigin,
  type BookingCreateOrigin,
} from '@/server/bookings/idempotency';
import { runBookingCreateLegacyCapacityCreate } from '@/server/bookings/legacy-capacity-create';
import { runBookingCreateUnifiedValidation } from '@/server/bookings/unified-validation-create';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePrecommitContextResult } from '@/server/bookings/create-precommit-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';
import type { NextResponse } from 'next/server';

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
      createOrigin: BookingCreateOrigin;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

export async function runBookingCreatePersistence({
  client,
  clientIp,
  legacyCapacityRunner = runBookingCreateLegacyCapacityCreate,
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
  pastTimeBlocking: boolean;
  pastTimeGraceMinutes: number;
  precommit: BookingCreatePrecommitContext;
  request: BookingCreateRequest;
  requestContext: Pick<
    BookingCreateRequestContext,
    'bookingDetails' | 'bookingSource' | 'clientRequestId' | 'headerIdempotencyKey' | 'requestSource'
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
      createOrigin: precommit.createOrigin ?? 'recovered',
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
    bookingDetails: requestContext.bookingDetails,
  };

  if (useUnifiedValidation) {
    const unifiedValidationResult = await unifiedValidationRunner({
      ...sharedArgs,
      scheduleTimezone: precommit.scheduleTimezone,
      pastTimeBlocking,
      pastTimeGraceMinutes,
    });

    if (unifiedValidationResult.kind === 'response') {
      return unifiedValidationResult;
    }

    return {
      kind: 'created',
      booking: unifiedValidationResult.booking,
      customer: precommit.customer,
      idempotencyKey: precommit.idempotencyKey,
      reusedExisting: unifiedValidationResult.reusedExisting,
      createOrigin: resolveBookingCreateOrigin({
        booking: unifiedValidationResult.booking,
        duplicate: unifiedValidationResult.reusedExisting,
        headerIdempotencyKey: requestContext.headerIdempotencyKey,
        recovered: false,
      }),
    };
  }

  const legacyCapacityResult = await legacyCapacityRunner({
    ...sharedArgs,
    clientIp,
    requestSource: requestContext.requestSource,
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
    createOrigin: resolveBookingCreateOrigin({
      booking: legacyCapacityResult.booking,
      duplicate: legacyCapacityResult.reusedExisting,
      headerIdempotencyKey: requestContext.headerIdempotencyKey,
      recovered: legacyCapacityResult.recovered,
    }),
  };
}
