import { NextResponse } from 'next/server';

import { captureRestaurantServerEvent, captureServerException } from '@/lib/posthog/server';
import {
  buildBookingCreateFailureObservabilityEvent,
  mapBookingApiError,
} from '@/server/bookings/api-error';
import { recordObservabilityEvent } from '@/server/observability';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

export type BookingCreateFailureLogger = (
  message: string,
  context: {
    message: string;
    code: string;
    stack?: string;
    debugInfo: {
      restaurantId?: string;
      date: string;
      party: number;
      email: string | null;
    };
  },
) => void;

export type BookingCreateFailureEventRecorder = typeof recordObservabilityEvent;

export function buildBookingCreateFailureResponse({
  error,
  eventRecorder = recordObservabilityEvent,
  logger = console.error,
  request,
  restaurantId,
}: {
  error: unknown;
  eventRecorder?: BookingCreateFailureEventRecorder;
  logger?: BookingCreateFailureLogger;
  request: BookingCreateRequest;
  restaurantId: string;
}): NextResponse {
  const apiError = mapBookingApiError(error);

  logger('[bookings][POST] Error finishing booking:', {
    message: error instanceof Error ? error.message : String(error),
    code: apiError.body.code,
    stack: error instanceof Error ? error.stack : undefined,
    debugInfo: {
      restaurantId: request.restaurantId,
      date: request.date,
      party: request.party,
      email: maskEmailForBookingCreateLog(request.email),
    },
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
    props: { code: apiError.body.code, status: apiError.status, source: 'api' },
  });
  captureServerException(error, {
    groups: restaurantId ? { restaurant: restaurantId } : undefined,
    properties: {
      restaurantId,
      code: apiError.body.code,
      path: '/api/bookings',
      source: 'api',
    },
  });

  return NextResponse.json(apiError.body, { status: apiError.status });
}

export function maskEmailForBookingCreateLog(email: string): string | null {
  return `${email.split('@')[0].slice(0, 3)}...`;
}
