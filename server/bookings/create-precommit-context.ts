import { NextResponse } from 'next/server';

import { deriveEndTimeFromDuration, inferMealTypeFromTime } from '@/server/bookings';
import { runBookingCreateCapacityPrecheck } from '@/server/bookings/capacity-failure-response';
import { resolveBookingCreateCustomerContext } from '@/server/bookings/create-customer-context';
import { runBookingCreateScheduleGate } from '@/server/bookings/create-schedule-gate';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import { recoverBookingRecord } from '@/server/bookings/recovery';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateCustomerContext } from '@/server/bookings/create-customer-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

type BookingCreatePrecommitClient = NonNullable<
  Parameters<typeof resolveBookingCreateCustomerContext>[0]['client']
> &
  Parameters<typeof runBookingCreateScheduleGate>[0]['client'] &
  Parameters<typeof resolveBookingDurationMinutes>[0]['client'] &
  Parameters<typeof recoverBookingRecord>[0] &
  Parameters<typeof runBookingCreateCapacityPrecheck>[0]['client'];

export type BookingCreateScheduleGateRunner = typeof runBookingCreateScheduleGate;
export type BookingCreateDurationResolver = typeof resolveBookingDurationMinutes;
export type BookingCreateEndTimeDeriver = typeof deriveEndTimeFromDuration;
export type BookingCreateCustomerContextResolver = typeof resolveBookingCreateCustomerContext;
export type BookingCreateRecoveredRecordResolver = typeof recoverBookingRecord;
export type BookingCreatePrecommitCapacityPrechecker = typeof runBookingCreateCapacityPrecheck;
export type BookingCreateMealTypeInferrer = typeof inferMealTypeFromTime;

export type BookingCreatePrecommitContextResult =
  | {
      kind: 'continue';
      booking: BookingRecord | undefined;
      bookingType: BookingCreateRequest['bookingType'];
      customer: BookingCreateCustomerContext['customer'];
      durationMinutes: number;
      endTime: string;
      idempotencyKey: string;
      reusedExisting: boolean;
      scheduleTimezone: string | null;
      startTime: string;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

export async function runBookingCreatePrecommitContext({
  capacityPrechecker = runBookingCreateCapacityPrecheck,
  client,
  clientIp,
  customerContextResolver = resolveBookingCreateCustomerContext,
  durationResolver = resolveBookingDurationMinutes,
  endTimeDeriver = deriveEndTimeFromDuration,
  mealTypeInferrer = inferMealTypeFromTime,
  onCapacityPrecheckError,
  pastTimeBlocking,
  pastTimeGraceMinutes,
  recoveredRecordResolver = recoverBookingRecord,
  request,
  requestContext,
  restaurantId,
  scheduleGateRunner = runBookingCreateScheduleGate,
}: {
  capacityPrechecker?: BookingCreatePrecommitCapacityPrechecker;
  client: BookingCreatePrecommitClient;
  clientIp: string;
  customerContextResolver?: BookingCreateCustomerContextResolver;
  durationResolver?: BookingCreateDurationResolver;
  endTimeDeriver?: BookingCreateEndTimeDeriver;
  mealTypeInferrer?: BookingCreateMealTypeInferrer;
  onCapacityPrecheckError?: (error: unknown) => void;
  pastTimeBlocking: boolean;
  pastTimeGraceMinutes?: number;
  recoveredRecordResolver?: BookingCreateRecoveredRecordResolver;
  request: BookingCreateRequest;
  requestContext: Pick<BookingCreateRequestContext, 'headerIdempotencyKey' | 'requestSource'>;
  restaurantId: string;
  scheduleGateRunner?: BookingCreateScheduleGateRunner;
}): Promise<BookingCreatePrecommitContextResult> {
  let bookingType = request.bookingType ?? mealTypeInferrer(request.time);
  let startTime = request.time;
  let scheduleTimezone: string | null = null;

  const scheduleGate = await scheduleGateRunner({
    client,
    restaurantId,
    date: request.date,
    requestedTime: request.time,
    fallbackBookingType: bookingType,
    pastTimeBlocking,
    pastTimeGraceMinutes,
    requestSource: requestContext.requestSource,
    clientIp,
  });

  if (scheduleGate.kind === 'response') {
    return {
      kind: 'response',
      response: NextResponse.json(scheduleGate.body, scheduleGate.init),
    };
  }

  startTime = scheduleGate.startTime;
  bookingType = scheduleGate.bookingType;
  scheduleTimezone = scheduleGate.scheduleTimezone;

  const { durationMinutes } = await durationResolver({
    restaurantId,
    bookingDate: request.date,
    startTime,
    partySize: request.party,
    bookingOption: bookingType,
    timezone: scheduleTimezone,
    client,
  });
  const endTime = endTimeDeriver(startTime, durationMinutes);

  const customerContext = await customerContextResolver({
    client,
    restaurantId,
    bookingDate: request.date,
    startTime,
    endTime,
    email: request.email,
    phone: request.phone,
    name: request.name,
    marketingOptIn: request.marketingOptIn,
    headerIdempotencyKey: requestContext.headerIdempotencyKey,
  });
  const { customer, idempotencyKey } = customerContext;

  const booking = await recoveredRecordResolver(client, {
    restaurantId,
    idempotencyKey,
    customerId: customer.id,
    bookingDate: request.date,
    startTime,
    endTime,
  });
  let reusedExisting = false;

  if (booking) {
    reusedExisting = true;
  }

  if (!booking) {
    const capacityPrecheck = await capacityPrechecker({
      client,
      restaurantId,
      date: request.date,
      startTime,
      partySize: request.party,
      durationMinutes,
      bookingOption: bookingType,
      requestSource: requestContext.requestSource,
      clientIp,
      onError: onCapacityPrecheckError,
    });

    if (capacityPrecheck.kind === 'response') {
      return capacityPrecheck;
    }
  }

  return {
    kind: 'continue',
    booking: booking ?? undefined,
    bookingType,
    customer,
    durationMinutes,
    endTime,
    idempotencyKey,
    reusedExisting,
    scheduleTimezone,
    startTime,
  };
}
