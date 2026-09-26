import { DateTime } from 'luxon';
import { NextResponse } from 'next/server';

import { deriveEndTimeFromDuration, inferMealTypeFromTime } from '@/server/bookings';
import { runBookingCreateCapacityPrecheck } from '@/server/bookings/capacity-failure-response';
import { resolveBookingCreateCustomerContext } from '@/server/bookings/create-customer-context';
import { runBookingCreateScheduleGate } from '@/server/bookings/create-schedule-gate';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import {
  buildIdempotencyKeyReusedResponse,
  matchesIdempotentCreatePayload,
  resolveBookingCreateOrigin,
  type BookingCreateOrigin,
} from '@/server/bookings/idempotency';
import {
  findBookingByIdempotencyKey,
  recoverBookingRecordWithMethod,
} from '@/server/bookings/recovery';
import { DEFAULT_SEATING_PREFERENCE } from '@/server/bookings/request-validation';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateCustomerContext } from '@/server/bookings/create-customer-context';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

type BookingCreatePrecommitClient = NonNullable<
  Parameters<typeof resolveBookingCreateCustomerContext>[0]['client']
> &
  Parameters<typeof runBookingCreateScheduleGate>[0]['client'] &
  Parameters<typeof resolveBookingDurationMinutes>[0]['client'] &
  Parameters<typeof recoverBookingRecordWithMethod>[0] &
  Parameters<typeof runBookingCreateCapacityPrecheck>[0]['client'];

export type BookingCreateScheduleGateRunner = typeof runBookingCreateScheduleGate;
export type BookingCreateDurationResolver = typeof resolveBookingDurationMinutes;
export type BookingCreateEndTimeDeriver = typeof deriveEndTimeFromDuration;
export type BookingCreateCustomerContextResolver = typeof resolveBookingCreateCustomerContext;
export type BookingCreateRecoveredRecordResolver = typeof recoverBookingRecordWithMethod;
export type BookingCreateKeyedBookingFinder = typeof findBookingByIdempotencyKey;
export type BookingCreatePrecommitCapacityPrechecker = typeof runBookingCreateCapacityPrecheck;
export type BookingCreateMealTypeInferrer = typeof inferMealTypeFromTime;

export type BookingCreatePrecommitContextResult =
  | {
      kind: 'continue';
      booking: BookingRecord | undefined;
      bookingType: BookingCreateRequest['bookingType'];
      /** The resolved customer; for a key replay only the booking's customer id is known. */
      customer: Pick<BookingCreateCustomerContext['customer'], 'id'>;
      durationMinutes: number;
      endTime: string;
      idempotencyKey: string;
      reusedExisting: boolean;
      /** How an existing booking was found; null when the request continues to insert. */
      createOrigin: Exclude<BookingCreateOrigin, 'inserted'> | null;
      scheduleTimezone: string | null;
      startTime: string;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

function bookingDurationMinutes(booking: BookingRecord): number {
  const start = booking.start_at
    ? DateTime.fromISO(booking.start_at, { setZone: true }).toMillis()
    : Number.NaN;
  const end = booking.end_at
    ? DateTime.fromISO(booking.end_at, { setZone: true }).toMillis()
    : Number.NaN;
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? Math.round((end - start) / 60_000)
    : 0;
}

export async function runBookingCreatePrecommitContext({
  capacityPrechecker = runBookingCreateCapacityPrecheck,
  client,
  clientIp,
  customerContextResolver = resolveBookingCreateCustomerContext,
  durationResolver = resolveBookingDurationMinutes,
  endTimeDeriver = deriveEndTimeFromDuration,
  keyedBookingFinder = findBookingByIdempotencyKey,
  mealTypeInferrer = inferMealTypeFromTime,
  onCapacityPrecheckError,
  pastTimeBlocking,
  pastTimeGraceMinutes,
  recoveredRecordResolver = recoverBookingRecordWithMethod,
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
  keyedBookingFinder?: BookingCreateKeyedBookingFinder;
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

  const headerIdempotencyKey = requestContext.headerIdempotencyKey;

  // 0. A same-key retry of a booking that already committed is answered before the schedule
  //    gate. The gate re-reads the clock and the current hours, so a retry landing after the
  //    past-time grace, or after a staff hours or closure change, would otherwise be refused for
  //    a booking that exists. Only an exact match on the requested time short-circuits here; any
  //    other keyed booking falls through to the gate and the full check in step 1, which compares
  //    against the gate's normalized start time and answers a mismatch as IDEMPOTENCY_KEY_REUSED.
  let prefetchedKeyedBooking: BookingRecord | null | undefined;
  if (headerIdempotencyKey) {
    prefetchedKeyedBooking = await keyedBookingFinder(client, {
      restaurantId,
      idempotencyKey: headerIdempotencyKey,
    });
    if (
      prefetchedKeyedBooking &&
      matchesIdempotentCreatePayload(prefetchedKeyedBooking, {
        bookingDate: request.date,
        startTime: request.time,
        partySize: request.party,
        customerEmail: request.email,
        bookingType,
        seatingPreference: DEFAULT_SEATING_PREFERENCE,
        notes: request.notes ?? null,
      })
    ) {
      const replayed = prefetchedKeyedBooking;
      return {
        kind: 'continue',
        booking: replayed,
        bookingType: (replayed.booking_type as typeof bookingType | null) ?? bookingType,
        customer: { id: replayed.customer_id },
        durationMinutes: bookingDurationMinutes(replayed),
        endTime: replayed.end_time ?? '',
        idempotencyKey: headerIdempotencyKey,
        reusedExisting: true,
        createOrigin: 'key_replay',
        scheduleTimezone: null,
        startTime: replayed.start_time,
      };
    }
  }

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

  // 1. The client's own key, in the scope of the unique (restaurant_id, idempotency_key) index.
  //    A replay needs neither the capacity precheck (its own booking fills the slot) nor a
  //    customer write.
  const resolveKeyedReplay = async (): Promise<BookingCreatePrecommitContextResult | null> => {
    if (!headerIdempotencyKey) return null;

    // The first check reuses the lookup made before the gate; a later one (the capacity race)
    // must read again.
    const keyedBooking =
      prefetchedKeyedBooking !== undefined
        ? prefetchedKeyedBooking
        : await keyedBookingFinder(client, {
            restaurantId,
            idempotencyKey: headerIdempotencyKey,
          });
    prefetchedKeyedBooking = undefined;
    if (!keyedBooking) return null;

    if (
      !matchesIdempotentCreatePayload(keyedBooking, {
        bookingDate: request.date,
        startTime,
        partySize: request.party,
        customerEmail: request.email,
        bookingType,
        seatingPreference: DEFAULT_SEATING_PREFERENCE,
        notes: request.notes ?? null,
      })
    ) {
      return { kind: 'response', response: buildIdempotencyKeyReusedResponse() };
    }

    return {
      kind: 'continue',
      booking: keyedBooking,
      bookingType,
      customer: { id: keyedBooking.customer_id },
      durationMinutes,
      endTime,
      idempotencyKey: headerIdempotencyKey,
      reusedExisting: true,
      createOrigin: 'key_replay',
      scheduleTimezone,
      startTime,
    };
  };

  const keyedReplay = await resolveKeyedReplay();
  if (keyedReplay) {
    return keyedReplay;
  }

  // 2. Advisory capacity precheck before the customer upsert, so a full slot writes nothing.
  //    The create RPC stays the capacity authority; it needs the customer id, so the customer
  //    is still written before the definitive capacity outcome.
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
    // A same-key retry racing its own first attempt sees that booking filling the slot. Look
    // the key up once more before calling the slot full.
    return (await resolveKeyedReplay()) ?? capacityPrecheck;
  }

  const customerContext = await customerContextResolver({
    client,
    restaurantId,
    bookingDate: request.date,
    startTime,
    endTime,
    partySize: request.party,
    bookingType,
    seatingPreference: DEFAULT_SEATING_PREFERENCE,
    notes: request.notes ?? null,
    email: request.email,
    phone: request.phone,
    name: request.name,
    marketingOptIn: request.marketingOptIn,
    headerIdempotencyKey,
  });
  const { customer, idempotencyKey } = customerContext;

  // 3. Deterministic key (key-less clients) and the live-slot signature. Cancelled and
  //    no-show bookings never match, so a guest can rebook a slot they cancelled.
  const recovered = await recoveredRecordResolver(client, {
    restaurantId,
    idempotencyKey: headerIdempotencyKey ? null : idempotencyKey,
    customerId: customer.id,
    bookingDate: request.date,
    startTime,
    endTime,
    partySize: request.party,
  });

  if (recovered) {
    const origin = resolveBookingCreateOrigin({
      booking: recovered.booking,
      duplicate: true,
      headerIdempotencyKey,
      recovered: true,
    });
    return {
      kind: 'continue',
      booking: recovered.booking,
      bookingType,
      customer,
      durationMinutes,
      endTime,
      idempotencyKey,
      reusedExisting: true,
      createOrigin: origin === 'inserted' ? null : origin,
      scheduleTimezone,
      startTime,
    };
  }

  return {
    kind: 'continue',
    booking: undefined,
    bookingType,
    customer,
    durationMinutes,
    endTime,
    idempotencyKey,
    reusedExisting: false,
    createOrigin: null,
    scheduleTimezone,
    startTime,
  };
}
