import { NextResponse } from 'next/server';

import {
  buildCapacityCreateGenericFailureResponse,
  buildCapacityCreateUnavailableResponse,
  buildCapacityFailureResponse,
  resolveCapacityCreateFailureDecision,
} from '@/server/bookings/capacity-failure-response';
import {
  buildCapacityCreateBookingParams,
  enforceBookingCreateInitialStatus,
  type BookingCreatePayloadBase,
} from '@/server/bookings/create-payloads';
import { resolveMissingBookingCreateRecord } from '@/server/bookings/recovery';
import { createBookingWithCapacityCheck } from '@/server/capacity';

import type { BookingRecord } from '@/server/bookings';

type LegacyCapacityCreateClient = Parameters<
  typeof resolveMissingBookingCreateRecord
>[0]['client'] &
  Parameters<typeof enforceBookingCreateInitialStatus>[0]['client'];

export type BookingCreateCapacityCreator = typeof createBookingWithCapacityCheck;
export type BookingCreateMissingRecordResolver = typeof resolveMissingBookingCreateRecord;
export type BookingCreateInitialStatusEnforcer = typeof enforceBookingCreateInitialStatus;

export type BookingCreateLegacyCapacityResult =
  | {
      kind: 'created';
      booking: BookingRecord;
      reusedExisting: boolean;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

export async function runBookingCreateLegacyCapacityCreate(
  args: BookingCreatePayloadBase & {
    client: LegacyCapacityCreateClient;
    clientIp: string;
    requestSource: string;
    capacityCreator?: BookingCreateCapacityCreator;
    missingRecordResolver?: BookingCreateMissingRecordResolver;
    initialStatusEnforcer?: BookingCreateInitialStatusEnforcer;
    onStatusError?: (error: unknown) => void;
  },
): Promise<BookingCreateLegacyCapacityResult> {
  const bookingResult = await (args.capacityCreator ?? createBookingWithCapacityCheck)(
    buildCapacityCreateBookingParams({
      request: args.request,
      customer: args.customer,
      restaurantId: args.restaurantId,
      bookingType: args.bookingType,
      startTime: args.startTime,
      endTime: args.endTime,
      durationMinutes: args.durationMinutes,
      bookingSource: args.bookingSource,
      idempotencyKey: args.idempotencyKey,
      clientRequestId: args.clientRequestId,
      bookingDetails: args.bookingDetails,
    }),
  );

  if (!bookingResult.success) {
    const failureDecision = resolveCapacityCreateFailureDecision({
      code: bookingResult.error,
      message: bookingResult.message,
      details: bookingResult.details,
    });

    if (failureDecision.kind === 'unavailable') {
      const response = buildCapacityCreateUnavailableResponse({
        message: failureDecision.message,
        details: failureDecision.details,
      });
      return {
        kind: 'response',
        response: NextResponse.json(response.body, response.init),
      };
    }

    if (failureDecision.kind === 'capacity_failure') {
      return {
        kind: 'response',
        response: await buildCapacityFailureResponse({
          client: args.client,
          restaurantId: args.restaurantId,
          date: args.request.date,
          startTime: args.startTime,
          partySize: args.request.party,
          durationMinutes: args.durationMinutes,
          bookingOption: args.bookingType,
          requestSource: args.requestSource,
          clientIp: args.clientIp,
          code: failureDecision.code,
          message: failureDecision.message,
          details: failureDecision.details,
          retryable: failureDecision.retryable,
          retryAfterSeconds: failureDecision.retryAfterSeconds,
        }),
      };
    }

    const response = buildCapacityCreateGenericFailureResponse({
      message: failureDecision.message,
      code: failureDecision.code,
      details: failureDecision.details,
    });
    return {
      kind: 'response',
      response: NextResponse.json(response.body, response.init),
    };
  }

  const reusedExisting = bookingResult.duplicate === true;
  let booking = bookingResult.booking as BookingRecord | undefined;

  if (!booking) {
    const recoveredBooking = await (
      args.missingRecordResolver ?? resolveMissingBookingCreateRecord
    )({
      client: args.client,
      resolveArgs: {
        fallback: {
          request: args.request,
          customer: args.customer,
          restaurantId: args.restaurantId,
          bookingType: args.bookingType,
          startTime: args.startTime,
          endTime: args.endTime,
          durationMinutes: args.durationMinutes,
          bookingSource: args.bookingSource,
          idempotencyKey: args.idempotencyKey,
          clientRequestId: args.clientRequestId,
          bookingDetails: args.bookingDetails,
        },
        recovery: {
          restaurantId: args.restaurantId,
          idempotencyKey: args.idempotencyKey,
          customerId: args.customer.id,
          bookingDate: args.request.date,
          startTime: args.startTime,
          endTime: args.endTime,
        },
        restaurantId: args.restaurantId,
        source: args.requestSource,
      },
    });

    if (!recoveredBooking) {
      const response = buildCapacityCreateUnavailableResponse({
        message: 'Booking could not be confirmed safely. Please try again.',
      });
      return {
        kind: 'response',
        response: NextResponse.json(response.body, response.init),
      };
    }

    booking = recoveredBooking;
  }

  const enforcedBooking = await (args.initialStatusEnforcer ?? enforceBookingCreateInitialStatus)({
    booking,
    client: args.client,
    reusedExisting,
    onError: args.onStatusError,
  });

  return {
    kind: 'created',
    booking: enforcedBooking,
    reusedExisting,
  };
}
