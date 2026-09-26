import { NextResponse } from 'next/server';

import { resolveRequestCorrelationId } from '@/lib/observability/request-correlation';
import { captureRestaurantServerEvent } from '@/lib/posthog/server';
import { parseBookingAttemptHeaders } from '@/server/bookings/attempt-context';
import { completeBookingCreate } from '@/server/bookings/create-completion';
import { runBookingCreateEntryGate } from '@/server/bookings/create-entry-gate';
import { buildBookingCreateFailureResponse } from '@/server/bookings/create-failure-response';
import { runBookingCreatePersistence } from '@/server/bookings/create-persistence';
import { runBookingCreatePrecommitContext } from '@/server/bookings/create-precommit-context';
import {
  buildBookingCreateInvalidJsonFailure,
  parseBookingCreateRequestPayload,
} from '@/server/bookings/create-request-payload';
import { stringifyError } from '@/server/bookings/error-formatting';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingCreateCookieRequest } from '@/server/bookings/create-response';

export type BookingsPostServiceClientFactory = typeof getServiceSupabaseClient;
export type BookingsPostEntryGateRunner = typeof runBookingCreateEntryGate;
export type BookingsPostPrecommitRunner = typeof runBookingCreatePrecommitContext;
export type BookingsPostPersistenceRunner = typeof runBookingCreatePersistence;
export type BookingsPostCompletionRunner = typeof completeBookingCreate;
export type BookingsPostFailureResponseBuilder = typeof buildBookingCreateFailureResponse;

export type BookingsPostLogger = {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

export function buildBookingCreateInvalidJsonResponse(): NextResponse {
  const failure = buildBookingCreateInvalidJsonFailure();
  return NextResponse.json(failure.body, { status: failure.status });
}

export async function buildBookingsPostHttpResponse({
  accessSecret,
  autoAssignEnabled,
  bookingPastTimeBlocking,
  bookingPastTimeGraceMinutes,
  bookingValidationUnified,
  clientIp,
  completionRunner = completeBookingCreate,
  cookieRequest,
  entryGateRunner = runBookingCreateEntryGate,
  failureResponseBuilder = buildBookingCreateFailureResponse,
  headers,
  inlineAutoAssignTimeoutMs,
  logger = console,
  payload,
  persistenceRunner = runBookingCreatePersistence,
  precommitRunner = runBookingCreatePrecommitContext,
  serviceClientFor = getServiceSupabaseClient,
}: {
  /** bk1 key for the creator cookie (`SESSION_RECOVERY_ACCESS_TOKEN_SECRET`). */
  accessSecret: string | null | undefined;
  autoAssignEnabled: boolean;
  bookingPastTimeBlocking?: boolean;
  bookingPastTimeGraceMinutes?: number;
  bookingValidationUnified: boolean;
  clientIp: string;
  completionRunner?: BookingsPostCompletionRunner;
  /** The incoming request: existing booking cookies and protocol for the creator cookie. */
  cookieRequest: BookingCreateCookieRequest;
  entryGateRunner?: BookingsPostEntryGateRunner;
  failureResponseBuilder?: BookingsPostFailureResponseBuilder;
  headers: Pick<Headers, 'get'>;
  inlineAutoAssignTimeoutMs?: number;
  logger?: BookingsPostLogger;
  payload: unknown;
  persistenceRunner?: BookingsPostPersistenceRunner;
  precommitRunner?: BookingsPostPrecommitRunner;
  serviceClientFor?: BookingsPostServiceClientFactory;
}): Promise<NextResponse> {
  const parsed = parseBookingCreateRequestPayload(payload);

  if (parsed.kind === 'failure') {
    return NextResponse.json(parsed.failure.body, { status: parsed.failure.status });
  }

  const request = parsed.request;
  const entryGate = await entryGateRunner({
    clientIp,
    headers,
    request,
  });

  if (entryGate.kind === 'response') {
    return entryGate.response;
  }

  const restaurantId = entryGate.restaurantId;

  // Correlation: the client wizard sends a stable attempt id (+ attempt number)
  // per logical submission; the correlation id is the active trace id (or a
  // sanitized request id) shared by the started/failed events, logs, and any
  // captured exception for this request.
  const attempt = parseBookingAttemptHeaders(headers);
  const correlationId = resolveRequestCorrelationId(headers);

  captureRestaurantServerEvent('booking_create_started', {
    restaurantId,
    correlationId,
    props: {
      source: 'api',
      ...(attempt.attemptId ? { attemptId: attempt.attemptId } : {}),
      ...(attempt.attemptNumber !== null ? { attempt: attempt.attemptNumber } : {}),
    },
  });

  try {
    const client = serviceClientFor();
    const pastTimeBlocking = bookingPastTimeBlocking ?? true;

    const precommit = await precommitRunner({
      client,
      clientIp,
      onCapacityPrecheckError: (capacityPrecheckError) => {
        logger.error('[bookings][POST][capacity-precheck]', stringifyError(capacityPrecheckError));
      },
      pastTimeBlocking,
      pastTimeGraceMinutes: bookingPastTimeGraceMinutes,
      request,
      requestContext: entryGate.requestContext,
      restaurantId,
    });

    if (precommit.kind === 'response') {
      return precommit.response;
    }

    const persistence = await persistenceRunner({
      client,
      clientIp,
      pastTimeBlocking,
      pastTimeGraceMinutes: bookingPastTimeGraceMinutes ?? 5,
      precommit,
      request,
      requestContext: entryGate.requestContext,
      restaurantId,
      useUnifiedValidation: bookingValidationUnified,
    });

    if (persistence.kind === 'response') {
      return persistence.response;
    }

    return await completionRunner({
      accessSecret,
      autoAssignEnabled,
      client,
      cookieRequest,
      inlineAutoAssignTimeoutMs: inlineAutoAssignTimeoutMs ?? 4000,
      onInlineAutoAssignError: (error) => {
        logger.warn('[bookings][POST][inline-auto-assign] unexpected error', {
          error: stringifyError(error),
        });
      },
      onConsentPersistError: (consentError) => {
        logger.error('[bookings][POST][whatsapp-consent]', stringifyError(consentError));
      },
      onSideEffectsError: (jobError) => {
        logger.error('[bookings][POST][side-effects]', stringifyError(jobError));
      },
      onAutoAssignError: (autoError) => {
        logger.error('[bookings][POST][auto-assign]', stringifyError(autoError));
      },
      persistence,
      request,
      requestContext: entryGate.requestContext,
      restaurantId,
      useUnifiedValidation: bookingValidationUnified,
    });
  } catch (error: unknown) {
    return failureResponseBuilder({
      attempt,
      correlationId,
      error,
      request,
      restaurantId,
    });
  }
}
