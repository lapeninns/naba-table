import { NextResponse } from 'next/server';

import { mapValidationFailure, withValidationHeaders } from '@/server/booking/http';
import { buildBookingCapacityPrecheckFailedObservabilityEvent } from '@/server/bookings/create-observability-events';
import { checkSlotAvailability, findAlternativeSlots } from '@/server/capacity';
import { recordObservabilityEvent } from '@/server/observability';
import { anonymizeIp } from '@/server/security/request';

import type { BookingValidationResponse } from '@/server/booking/types';

type CapacityClient = Parameters<typeof findAlternativeSlots>[1];
type CapacityPrecheckClient = Parameters<typeof checkSlotAvailability>[1];

export type BookingCreateCapacityAvailabilityChecker = typeof checkSlotAvailability;
export type BookingCreateCapacityPrecheckObservabilityRecorder = typeof recordObservabilityEvent;

export type BookingCreateCapacityPrecheckResult =
  | { kind: 'continue' }
  | { kind: 'response'; response: NextResponse };

export type BookingAlternativeSlotResponse = {
  time: string;
  available: boolean;
  utilizationPercent: number;
};

export type CapacityCreateFailureResponseBody = {
  error: string;
  code: string;
  details: unknown;
};

export type UnifiedValidationCapacityExceededResponseBody = BookingValidationResponse & {
  alternatives: BookingAlternativeSlotResponse[];
};

export type CapacityCreateFailureDecision =
  | {
      kind: 'unavailable';
      message?: string | null;
      details?: unknown;
    }
  | {
      kind: 'capacity_failure';
      code: 'CAPACITY_EXCEEDED' | 'BOOKING_CONFLICT';
      message: string;
      details: Record<string, unknown> | null;
      retryable?: true;
      retryAfterSeconds?: number;
    }
  | {
      kind: 'generic';
      message?: string | null;
      code?: string | null;
      details?: unknown;
    };

function stringifyCapacityError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function asRecordDetails(details: unknown): Record<string, unknown> | null {
  return details && typeof details === 'object' && !Array.isArray(details)
    ? (details as Record<string, unknown>)
    : null;
}

export function resolveCapacityCreateFailureDecision({
  code,
  message,
  details,
}: {
  code?: string | null;
  message?: string | null;
  details?: unknown;
}): CapacityCreateFailureDecision {
  if (code === 'CAPACITY_UNAVAILABLE') {
    return {
      kind: 'unavailable',
      message,
      details,
    };
  }

  if (code === 'CAPACITY_EXCEEDED') {
    return {
      kind: 'capacity_failure',
      code,
      message: message ?? 'No capacity available',
      details: asRecordDetails(details),
    };
  }

  if (code === 'BOOKING_CONFLICT') {
    return {
      kind: 'capacity_failure',
      code,
      message: message ?? 'This time slot was just booked. Please try again.',
      details: asRecordDetails(details),
      retryable: true,
      retryAfterSeconds: 1,
    };
  }

  return {
    kind: 'generic',
    message,
    code,
    details,
  };
}

export async function safeFindBookingAlternatives(args: {
  client?: CapacityClient;
  restaurantId: string;
  date: string;
  partySize: number;
  preferredTime: string;
  durationMinutes?: number;
  bookingOption?: string | null;
}): Promise<BookingAlternativeSlotResponse[]> {
  try {
    const alternatives = await findAlternativeSlots(
      {
        restaurantId: args.restaurantId,
        date: args.date,
        partySize: args.partySize,
        preferredTime: args.preferredTime,
        durationMinutes: args.durationMinutes,
        bookingOption: args.bookingOption ?? null,
        maxAlternatives: 5,
        searchWindowMinutes: 120,
      },
      args.client,
    );

    return alternatives.map((slot) => ({
      time: slot.time,
      available: slot.available,
      utilizationPercent: slot.utilizationPercent,
    }));
  } catch (error) {
    console.error('[bookings][POST][alternatives]', stringifyCapacityError(error));
    return [];
  }
}

export async function buildCapacityFailureResponse(args: {
  client?: CapacityClient;
  restaurantId: string;
  date: string;
  startTime: string;
  partySize: number;
  durationMinutes?: number;
  bookingOption?: string | null;
  requestSource: string;
  clientIp: string;
  code: 'CAPACITY_EXCEEDED' | 'BOOKING_CONFLICT';
  message: string;
  details?: Record<string, unknown> | null;
  retryable?: boolean;
  retryAfterSeconds?: number;
}): Promise<NextResponse> {
  const alternatives = await safeFindBookingAlternatives({
    client: args.client,
    restaurantId: args.restaurantId,
    date: args.date,
    partySize: args.partySize,
    preferredTime: args.startTime,
    durationMinutes: args.durationMinutes,
    bookingOption: args.bookingOption ?? null,
  });

  if (args.code === 'CAPACITY_EXCEEDED') {
    void recordObservabilityEvent({
      source: args.requestSource,
      eventType: 'booking.capacity_exceeded',
      severity: 'warning',
      context: {
        restaurantId: args.restaurantId,
        date: args.date,
        time: args.startTime,
        partySize: args.partySize,
        ipScope: anonymizeIp(args.clientIp),
        alternativesFound: alternatives.length,
        ...(args.details ?? {}),
      },
    });
  }

  const utilizationPercent =
    args.details && typeof args.details.utilizationPercent === 'number'
      ? args.details.utilizationPercent
      : null;
  const retryAfterSeconds = args.retryAfterSeconds ?? 1;
  const headers: Record<string, string> = {};

  if (args.code === 'CAPACITY_EXCEEDED') {
    headers['X-Capacity-Exceeded'] = 'true';
    if (utilizationPercent !== null) {
      headers['X-Utilization-Percent'] = utilizationPercent.toString();
    }
  }

  if (args.code === 'BOOKING_CONFLICT') {
    headers['Retry-After'] = retryAfterSeconds.toString();
    headers['X-Conflict-Type'] = 'race_condition';
  }

  return NextResponse.json(
    {
      error: args.message,
      code: args.code,
      details: args.details ?? null,
      alternatives,
      ...(args.retryable ? { retryable: true, retryAfter: retryAfterSeconds } : {}),
    },
    { status: 409, headers },
  );
}

export async function runBookingCreateCapacityPrecheck(args: {
  client?: CapacityPrecheckClient;
  restaurantId: string;
  date: string;
  startTime: string;
  partySize: number;
  durationMinutes: number;
  bookingOption?: string | null;
  requestSource: string;
  clientIp: string;
  availabilityChecker?: BookingCreateCapacityAvailabilityChecker;
  observabilityRecorder?: BookingCreateCapacityPrecheckObservabilityRecorder;
  onError?: (error: unknown) => void;
}): Promise<BookingCreateCapacityPrecheckResult> {
  try {
    const availabilityCheck = await (args.availabilityChecker ?? checkSlotAvailability)(
      {
        restaurantId: args.restaurantId,
        date: args.date,
        time: args.startTime,
        partySize: args.partySize,
        durationMinutes: args.durationMinutes,
        bookingOption: args.bookingOption,
      },
      args.client,
    );

    if (availabilityCheck.available) {
      return { kind: 'continue' };
    }

    return {
      kind: 'response',
      response: await buildCapacityFailureResponse({
        client: args.client,
        restaurantId: args.restaurantId,
        date: args.date,
        startTime: args.startTime,
        partySize: args.partySize,
        durationMinutes: args.durationMinutes,
        bookingOption: args.bookingOption,
        requestSource: args.requestSource,
        clientIp: args.clientIp,
        code: 'CAPACITY_EXCEEDED',
        message: availabilityCheck.reason ?? 'No capacity available for this time slot.',
        details: {
          requestedTime: args.startTime,
          partySize: args.partySize,
          ...availabilityCheck.metadata,
        },
      }),
    };
  } catch (error) {
    args.onError?.(error);
    void (args.observabilityRecorder ?? recordObservabilityEvent)(
      buildBookingCapacityPrecheckFailedObservabilityEvent({
        source: args.requestSource,
        restaurantId: args.restaurantId,
        date: args.date,
        time: args.startTime,
        partySize: args.partySize,
        error: stringifyCapacityError(error),
      }),
    );
    return { kind: 'continue' };
  }
}

export function buildCapacityCreateUnavailableResponse(args: {
  message?: string | null;
  details?: unknown;
}): {
  body: CapacityCreateFailureResponseBody;
  init: { status: 503 };
} {
  return {
    body: {
      error: args.message ?? 'Capacity enforcement unavailable',
      code: 'CAPACITY_UNAVAILABLE',
      details: args.details ?? null,
    },
    init: { status: 503 },
  };
}

export function buildCapacityCreateGenericFailureResponse(args: {
  message?: string | null;
  code?: string | null;
  details?: unknown;
}): {
  body: CapacityCreateFailureResponseBody;
  init: { status: 500 };
} {
  return {
    body: {
      error: args.message ?? 'Unable to create booking',
      code: args.code ?? 'INTERNAL_ERROR',
      details: args.details ?? null,
    },
    init: { status: 500 },
  };
}

export async function buildUnifiedValidationCapacityExceededResponse(args: {
  client?: CapacityClient;
  response: BookingValidationResponse & { ok: false };
  restaurantId: string;
  date: string;
  partySize: number;
  preferredTime: string;
  durationMinutes?: number;
  bookingOption?: string | null;
}): Promise<{
  body: UnifiedValidationCapacityExceededResponseBody;
  init: {
    status: number;
    headers: Record<string, string>;
  };
} | null> {
  const primaryIssue = args.response.issues[0] ?? null;

  if (primaryIssue?.code !== 'CAPACITY_EXCEEDED') {
    return null;
  }

  const mapped = mapValidationFailure(args.response);
  const alternatives = await safeFindBookingAlternatives({
    client: args.client,
    restaurantId: args.restaurantId,
    date: args.date,
    partySize: args.partySize,
    preferredTime: args.preferredTime,
    durationMinutes: args.durationMinutes,
    bookingOption: args.bookingOption,
  });
  const utilizationPercent =
    primaryIssue.detail && typeof primaryIssue.detail.utilizationPercent === 'number'
      ? primaryIssue.detail.utilizationPercent
      : null;

  return {
    body: {
      ...mapped.body,
      alternatives,
    },
    init: withValidationHeaders({
      status: mapped.status,
      headers: {
        'X-Capacity-Exceeded': 'true',
        ...(utilizationPercent !== null
          ? { 'X-Utilization-Percent': utilizationPercent.toString() }
          : {}),
      },
    }),
  };
}
