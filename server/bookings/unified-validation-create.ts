import { BookingValidationError, createBookingValidationService } from '@/server/booking';
import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import { buildUnifiedValidationCapacityExceededResponse } from '@/server/bookings/capacity-failure-response';
import { buildBookingValidationCreatePayload } from '@/server/bookings/create-payloads';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePayloadBase } from '@/server/bookings/create-payloads';

type BookingCreateValidationClient = NonNullable<
  Parameters<typeof createBookingValidationService>[0]
>['client'];

export type BookingCreateValidationServiceFactory = typeof createBookingValidationService;

export type BookingCreateUnifiedValidationResult =
  | {
      kind: 'created';
      booking: BookingRecord;
      reusedExisting: boolean;
    }
  | {
      kind: 'response';
      body: unknown;
      init: {
        status: number;
        headers?: Record<string, string>;
      };
    };

export async function runBookingCreateUnifiedValidation(
  args: BookingCreatePayloadBase & {
    client: BookingCreateValidationClient;
    scheduleTimezone: string | null;
    pastTimeBlocking: boolean;
    pastTimeGraceMinutes: number;
    validationServiceFactory?: BookingCreateValidationServiceFactory;
  },
): Promise<BookingCreateUnifiedValidationResult> {
  const validationService = (args.validationServiceFactory ?? createBookingValidationService)({
    client: args.client,
  });

  const { input: bookingInput, context } = buildBookingValidationCreatePayload({
    request: args.request,
    customer: args.customer,
    restaurantId: args.restaurantId,
    bookingType: args.bookingType,
    startTime: args.startTime,
    endTime: args.endTime,
    durationMinutes: args.durationMinutes,
    scheduleTimezone: args.scheduleTimezone,
    pastTimeBlocking: args.pastTimeBlocking,
    pastTimeGraceMinutes: args.pastTimeGraceMinutes,
    bookingSource: args.bookingSource,
    idempotencyKey: args.idempotencyKey,
    clientRequestId: args.clientRequestId,
    bookingDetails: args.bookingDetails,
  });

  try {
    const commit = await validationService.createWithEnforcement(bookingInput, context);
    return {
      kind: 'created',
      booking: commit.booking as BookingRecord,
      reusedExisting: commit.duplicate === true,
    };
  } catch (error) {
    if (error instanceof BookingValidationError) {
      const capacityResponse = await buildUnifiedValidationCapacityExceededResponse({
        response: error.response,
        client: args.client,
        restaurantId: args.restaurantId,
        date: args.request.date,
        partySize: args.request.party,
        preferredTime: args.startTime,
        durationMinutes: args.durationMinutes,
        bookingOption: args.bookingType,
      });

      if (capacityResponse) {
        return {
          kind: 'response',
          body: capacityResponse.body,
          init: capacityResponse.init,
        };
      }

      const mapped = mapValidationFailure(error.response);
      return {
        kind: 'response',
        body: mapped.body,
        init: withValidationHeaders({ status: mapped.status }),
      };
    }

    throw error;
  }
}
