import { fieldsFromIssues } from '@/lib/api/errors';
import { bookingCreateRequestSchema } from '@/server/bookings/request-validation';
import { mapBookingZodValidationFailure } from '@/server/bookings/zod-validation-error';

import type { BookingCreateRequest } from '@/server/bookings/request-validation';

export type BookingCreatePayloadFailure = {
  status: number;
  /** C1 flat error body (`error` mirrors `message`). */
  body: {
    error: string;
    code: string;
    message: string;
    fields?: Record<string, string[]>;
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
    body: { error: 'Invalid JSON payload', code: 'INVALID_JSON', message: 'Invalid JSON payload' },
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
    const legacy = mapBookingZodValidationFailure(parsed.error);
    return {
      kind: 'failure',
      failure: {
        status: legacy.status,
        body: {
          error: legacy.body.error,
          code: legacy.body.code,
          message: legacy.body.error,
          fields: fieldsFromIssues(parsed.error.issues),
          details: legacy.body.details,
        },
      },
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
