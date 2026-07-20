import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import {
  buildBookingCreateFailureObservabilityEvent,
  mapBookingApiError,
} from '@/server/bookings/api-error';
import { recordObservabilityEvent } from '@/server/observability';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const bookingCreateLogger = logger.child({ module: 'api.bookings.create' });

export type BookingCreateFailureLogger = (
  message: string,
  context: Record<string, unknown>,
) => void;

export type BookingCreateAttemptContext = {
  attemptId: string | null;
  attemptNumber: number | null;
};

export type BookingCreateFailureEventRecorder = typeof recordObservabilityEvent;

const defaultFailureLogger: BookingCreateFailureLogger = (message, context) => {
  bookingCreateLogger.error(message, context);
};

export function buildBookingCreateFailureResponse({
  attempt = null,
  correlationId = null,
  error,
  eventRecorder = recordObservabilityEvent,
  logger: failureLogger = defaultFailureLogger,
  request,
  restaurantId,
}: {
  attempt?: BookingCreateAttemptContext | null;
  correlationId?: string | null;
  error: unknown;
  eventRecorder?: BookingCreateFailureEventRecorder;
  logger?: BookingCreateFailureLogger;
  request: BookingCreateRequest;
  restaurantId: string;
}): NextResponse {
  const apiError = mapBookingApiError(error);
  const attemptId = attempt?.attemptId ?? null;
  const attemptNumber = attempt?.attemptNumber ?? null;

  // Structured (PostHog Logs-exported) record: no email/phone, error object is
  // redacted by the logger, and the correlation id joins this log to the
  // matching booking_create_failed event and $exception.
  failureLogger('booking create failed', {
    code: apiError.body.code,
    status: apiError.status,
    route: '/api/bookings',
    restaurantId: request.restaurantId ?? restaurantId,
    date: request.date,
    party: request.party,
    ...(correlationId ? { correlationId } : {}),
    ...(attemptId ? { attemptId } : {}),
    ...(attemptNumber !== null ? { attempt: attemptNumber } : {}),
    error,
  });

  void eventRecorder(
    buildBookingCreateFailureObservabilityEvent({
      apiError,
      restaurantId,
      bookingDate: request.date,
      email: request.email,
      phone: request.phone,
    }),
  );

  captureRestaurantServerEvent('booking_create_failed', {
    restaurantId,
    correlationId,
    props: {
      code: apiError.body.code,
      status: apiError.status,
      source: 'api',
      ...(attemptId ? { attemptId } : {}),
      ...(attemptNumber !== null ? { attempt: attemptNumber } : {}),
    },
  });
  captureServerException(error, {
    groups: restaurantId ? { restaurant: restaurantId } : undefined,
    correlationId,
    properties: {
      restaurantId,
      code: apiError.body.code,
      path: '/api/bookings',
      source: 'api',
      ...(attemptId ? { attemptId } : {}),
    },
  });

  return NextResponse.json(apiError.body, { status: apiError.status });
}
