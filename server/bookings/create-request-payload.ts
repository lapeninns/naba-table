import { bookingCreateRequestSchema } from '@/server/bookings/request-validation';
import { mapBookingZodValidationFailure } from '@/server/bookings/zod-validation-error';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

export type BookingCreatePayloadFailure = {
  status: number;
  body: {
    error: string;
    code?: string;
    details?: unknown;
  };
};

export type BookingCreatePayloadParseResult =
  | {
      kind: 'request';
      request: BookingCreateRequest;
    }
  | {
      kind: 'failure';
      failure: BookingCreatePayloadFailure;
    };

export function buildBookingCreateInvalidJsonFailure(): BookingCreatePayloadFailure {
  return {
    status: 400,
    body: { error: 'Invalid JSON payload' },
  };
}

export function parseBookingCreateRequestPayload(
  payload: unknown,
): BookingCreatePayloadParseResult {
  const body = normalizeBookingCreatePayload(payload);

  const parsed = bookingCreateRequestSchema.safeParse({
    ...body,
    party: Number(body.party ?? 0),
  });

  if (!parsed.success) {
    return {
      kind: 'failure',
      failure: mapBookingZodValidationFailure(parsed.error),
    };
  }

  return {
    kind: 'request',
    request: parsed.data,
  };
}

function normalizeBookingCreatePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}
