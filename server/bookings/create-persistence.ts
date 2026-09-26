import {
  matchesIdempotentCreatePayload,
  resolveBookingCreateOrigin,
  withIdempotencyKeyKind,
  type BookingCreateOrigin,
} from '@/server/bookings/idempotency';
import { runBookingCreateLegacyCapacityCreate } from '@/server/bookings/legacy-capacity-create';
import {
  findBookingByIdempotencyKey,
  type BookingRecoveryClient,
} from '@/server/bookings/recovery';
import { runBookingCreateUnifiedValidation } from '@/server/bookings/unified-validation-create';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePrecommitContextResult } from '@/server/bookings/create-precommit-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';
import type { NextResponse } from 'next/server';

type BookingCreatePersistenceClient = Parameters<
  typeof runBookingCreateUnifiedValidation
>[0]['client'] &
  Parameters<typeof runBookingCreateLegacyCapacityCreate>[0]['client'] &
  BookingRecoveryClient;
type BookingCreatePrecommitContext = Extract<
  BookingCreatePrecommitContextResult,
  { kind: 'continue' }
>;

export type BookingCreateUnifiedValidationRunner = typeof runBookingCreateUnifiedValidation;
export type BookingCreateLegacyCapacityRunner = typeof runBookingCreateLegacyCapacityCreate;
export type BookingCreatePersistenceKeyedBookingFinder = typeof findBookingByIdempotencyKey;

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
  keyedBookingFinder = findBookingByIdempotencyKey,
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
  keyedBookingFinder?: BookingCreatePersistenceKeyedBookingFinder;
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
    // Key-less clients get a server-derived key; the marker lets the RPC release it from a
    // cancelled or no-show booking instead of replaying the finished booking.
    bookingDetails: withIdempotencyKeyKind(
      requestContext.bookingDetails,
      requestContext.headerIdempotencyKey,
    ),
  };

  const headerIdempotencyKey = requestContext.headerIdempotencyKey;

  /**
   * A same-key retry can lose the race to its own first attempt after the precommit key lookup
   * missed: validation then sees that booking filling the slot. Before answering with a
   * failure, look the client's key up again; a matching booking is this request's replay.
   */
  const resolveFailureAsKeyReplay = async (
    failure: Extract<BookingCreatePersistenceResult, { kind: 'response' }>,
  ): Promise<BookingCreatePersistenceResult> => {
    if (!headerIdempotencyKey) return failure;

    const keyed = await keyedBookingFinder(client, {
      restaurantId,
      idempotencyKey: headerIdempotencyKey,
    });
    if (
      !keyed ||
      !matchesIdempotentCreatePayload(keyed, {
        bookingDate: request.date,
        startTime: precommit.startTime,
        partySize: request.party,
        customerId: precommit.customer.id,
        customerEmail: request.email,
      })
    ) {
      return failure;
    }

    return {
      kind: 'created',
      booking: keyed,
      customer: precommit.customer,
      idempotencyKey: headerIdempotencyKey,
      reusedExisting: true,
      createOrigin: 'key_replay',
    };
  };

  if (useUnifiedValidation) {
    const unifiedValidationResult = await unifiedValidationRunner({
      ...sharedArgs,
      scheduleTimezone: precommit.scheduleTimezone,
      pastTimeBlocking,
      pastTimeGraceMinutes,
    });

    if (unifiedValidationResult.kind === 'response') {
      return resolveFailureAsKeyReplay(unifiedValidationResult);
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
    return resolveFailureAsKeyReplay(legacyCapacityResult);
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
