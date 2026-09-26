import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api/errors';
import { buildBookingCreateRateLimitedObservabilityEvent } from '@/server/bookings/create-observability-events';
import {
  buildBookingCreateRequestContext,
  type BookingCreateRequestContext,
} from '@/server/bookings/create-request-context';
import { buildBookingCreateRateLimitResponse } from '@/server/bookings/rate-limit-response';
import {
  resolveBookingRestaurantId,
  type BookingRestaurantResolutionResult,
} from '@/server/bookings/restaurant-resolution';
import { recordObservabilityEvent } from '@/server/observability';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp } from '@/server/security/request';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

export type BookingCreateEntryRestaurantResolver = typeof resolveBookingRestaurantId;
export type BookingCreateEntryRequestContextBuilder = typeof buildBookingCreateRequestContext;
export type BookingCreateEntryRateLimiter = typeof consumeRateLimit;
export type BookingCreateEntryEventRecorder = typeof recordObservabilityEvent;

export type BookingCreateEntryGateResult =
  | {
      kind: 'continue';
      restaurantId: string;
      requestContext: BookingCreateRequestContext;
    }
  | {
      kind: 'response';
      response: NextResponse;
    };

export async function runBookingCreateEntryGate({
  clientIp,
  eventRecorder = recordObservabilityEvent,
  headers,
  rateLimiter = consumeRateLimit,
  request,
  requestContextBuilder = buildBookingCreateRequestContext,
  restaurantResolver = resolveBookingRestaurantId,
}: {
  clientIp: string;
  eventRecorder?: BookingCreateEntryEventRecorder;
  headers: Pick<Headers, 'get'>;
  rateLimiter?: BookingCreateEntryRateLimiter;
  request: BookingCreateRequest;
  requestContextBuilder?: BookingCreateEntryRequestContextBuilder;
  restaurantResolver?: BookingCreateEntryRestaurantResolver;
}): Promise<BookingCreateEntryGateResult> {
  const restaurantResolution = await restaurantResolver({
    restaurantId: request.restaurantId,
    restaurantSlug: request.restaurantSlug,
  });

  if (!restaurantResolution.ok) {
    return {
      kind: 'response',
      response: buildRestaurantResolutionResponse(restaurantResolution),
    };
  }

  const restaurantId = restaurantResolution.restaurantId;
  const requestContext = requestContextBuilder(headers);

  const rateResult = await rateLimiter({
    identifier: `bookings:create:${restaurantId}:${clientIp}`,
    limit: 60,
    windowMs: 60_000,
  });

  if (!rateResult.ok) {
    void eventRecorder(
      buildBookingCreateRateLimitedObservabilityEvent({
        source: requestContext.requestSource,
        restaurantId,
        ipScope: anonymizeIp(clientIp),
        resetAt: rateResult.resetAt,
        limit: rateResult.limit,
        windowMs: 60_000,
        rateSource: rateResult.source,
      }),
    );

    const response = buildBookingCreateRateLimitResponse({ rateLimit: rateResult });
    return {
      kind: 'response',
      // C1 flat body; the builder's Retry-After and X-RateLimit-* headers are kept.
      response: NextResponse.json(
        { ...response.body, message: response.body.error, retryable: true },
        response.init,
      ),
    };
  }

  return {
    kind: 'continue',
    restaurantId,
    requestContext,
  };
}

function buildRestaurantResolutionResponse(
  result: Extract<BookingRestaurantResolutionResult, { ok: false }>,
): NextResponse {
  return apiError(result.status || 400, result.code, result.error);
}
