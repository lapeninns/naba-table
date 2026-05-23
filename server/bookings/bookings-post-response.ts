import { NextResponse } from 'next/server';

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
  autoAssignEnabled,
  bookingPastTimeBlocking,
  bookingPastTimeGraceMinutes,
  bookingValidationUnified,
  clientIp,
  completionRunner = completeBookingCreate,
  entryGateRunner = runBookingCreateEntryGate,
  failureResponseBuilder = buildBookingCreateFailureResponse,
  headers,
  inlineAutoAssignTimeoutMs,
  logger = console,
  payload,
  persistenceRunner = runBookingCreatePersistence,
  precommitRunner = runBookingCreatePrecommitContext,
  recoverySecret,
  recoveryTtlSeconds,
  serviceClientFor = getServiceSupabaseClient,
}: {
  autoAssignEnabled: boolean;
  bookingPastTimeBlocking?: boolean;
  bookingPastTimeGraceMinutes?: number;
  bookingValidationUnified: boolean;
  clientIp: string;
  completionRunner?: BookingsPostCompletionRunner;
  entryGateRunner?: BookingsPostEntryGateRunner;
  failureResponseBuilder?: BookingsPostFailureResponseBuilder;
  headers: Pick<Headers, 'get'>;
  inlineAutoAssignTimeoutMs?: number;
  logger?: BookingsPostLogger;
  payload: unknown;
  persistenceRunner?: BookingsPostPersistenceRunner;
  precommitRunner?: BookingsPostPrecommitRunner;
  recoverySecret?: string | null;
  recoveryTtlSeconds?: number | null;
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
      onStatusError: (statusError) => {
        logger.error('[bookings][POST][status-enforce]', stringifyError(statusError));
      },
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
      autoAssignEnabled,
      client,
      inlineAutoAssignTimeoutMs: inlineAutoAssignTimeoutMs ?? 4000,
      onInlineAutoAssignError: (error) => {
        logger.warn('[bookings][POST][inline-auto-assign] unexpected error', {
          error: stringifyError(error),
        });
      },
      onSideEffectsError: (jobError) => {
        logger.error('[bookings][POST][side-effects]', stringifyError(jobError));
      },
      onAutoAssignError: (autoError) => {
        logger.error('[bookings][POST][auto-assign]', stringifyError(autoError));
      },
      onTokenError: (tokenError) => {
        logger.error('[bookings][POST][confirmation-token]', stringifyError(tokenError));
      },
      onRecoveryCookieError: (recoveryTokenError) => {
        logger.error(
          '[bookings][POST][session-recovery-token]',
          stringifyError(recoveryTokenError),
        );
      },
      persistence,
      recoverySecret,
      recoveryTtlSeconds,
      request,
      requestContext: entryGate.requestContext,
      restaurantId,
      useUnifiedValidation: bookingValidationUnified,
    });
  } catch (error: unknown) {
    return failureResponseBuilder({
      error,
      request,
      restaurantId,
    });
  }
}
