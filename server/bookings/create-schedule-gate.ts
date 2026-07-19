import { buildBookingPastTimeBlockedObservabilityEvent } from '@/server/bookings/create-observability-events';
import { resolveBookingCreateScheduleSelection } from '@/server/bookings/create-schedule-selection';
import {
  buildOperatingHoursClosedResponse,
  type OperatingHoursClosedResponseBody,
} from '@/server/bookings/operating-hours-response';
import {
  buildPastTimeBlockedResponse,
  type PastTimeBlockedResponseBody,
} from '@/server/bookings/past-time-response';
import { PastBookingError, assertBookingNotInPast } from '@/server/bookings/pastTimeValidation';
import { OperatingHoursError } from '@/server/bookings/timeValidation';
import { recordObservabilityEvent } from '@/server/observability';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { anonymizeIp } from '@/server/security/request';

import type { BookingType } from '@/lib/enums';

type BookingCreateScheduleClient = NonNullable<
  Parameters<typeof getRestaurantSchedule>[1]
>['client'];

export type BookingCreateScheduleFetcher = typeof getRestaurantSchedule;
export type BookingCreatePastTimeChecker = typeof assertBookingNotInPast;
export type BookingCreateScheduleGateObservabilityRecorder = typeof recordObservabilityEvent;

export type BookingCreateScheduleGateResponseBody =
  | OperatingHoursClosedResponseBody
  | PastTimeBlockedResponseBody;

export type BookingCreateScheduleGateResult =
  | {
      kind: 'continue';
      startTime: string;
      bookingType: BookingType;
      scheduleTimezone: string;
    }
  | {
      kind: 'response';
      body: BookingCreateScheduleGateResponseBody;
      init: { status: 400 | 422 };
    };

export async function runBookingCreateScheduleGate(args: {
  client?: BookingCreateScheduleClient;
  restaurantId: string;
  date: string;
  requestedTime: string;
  fallbackBookingType: BookingType;
  pastTimeBlocking: boolean;
  pastTimeGraceMinutes?: number;
  requestSource: string;
  clientIp: string;
  scheduleFetcher?: BookingCreateScheduleFetcher;
  pastTimeChecker?: BookingCreatePastTimeChecker;
  observabilityRecorder?: BookingCreateScheduleGateObservabilityRecorder;
}): Promise<BookingCreateScheduleGateResult> {
  const fetchSchedule = args.scheduleFetcher ?? getRestaurantSchedule;
  const checkPastTime = args.pastTimeChecker ?? assertBookingNotInPast;
  const recordEvent = args.observabilityRecorder ?? recordObservabilityEvent;
  let schedule: Awaited<ReturnType<typeof getRestaurantSchedule>> | null = null;

  try {
    schedule = await fetchSchedule(args.restaurantId, {
      date: args.date,
      client: args.client,
    });

    const scheduleSelection = resolveBookingCreateScheduleSelection({
      schedule,
      requestedTime: args.requestedTime,
      fallbackBookingType: args.fallbackBookingType,
    });

    if (args.pastTimeBlocking) {
      try {
        checkPastTime(schedule.timezone, args.date, scheduleSelection.startTime, {
          graceMinutes: args.pastTimeGraceMinutes,
        });
      } catch (pastTimeError) {
        if (pastTimeError instanceof PastBookingError) {
          void recordEvent(
            buildBookingPastTimeBlockedObservabilityEvent({
              source: args.requestSource,
              restaurantId: args.restaurantId,
              ipScope: anonymizeIp(args.clientIp),
              details: pastTimeError.details,
            }),
          );

          return {
            kind: 'response',
            ...buildPastTimeBlockedResponse(pastTimeError),
          };
        }
        throw pastTimeError;
      }
    }

    return {
      kind: 'continue',
      startTime: scheduleSelection.startTime,
      bookingType: scheduleSelection.bookingType,
      scheduleTimezone: scheduleSelection.scheduleTimezone,
    };
  } catch (validationError) {
    if (validationError instanceof OperatingHoursError) {
      return {
        kind: 'response',
        ...buildOperatingHoursClosedResponse({
          error: validationError,
          schedule,
          requestedTime: args.requestedTime,
          bookingType: args.fallbackBookingType,
        }),
      };
    }
    throw validationError;
  }
}
