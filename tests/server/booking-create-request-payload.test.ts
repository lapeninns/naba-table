import { describe, expect, it } from 'vitest';

import {
  buildBookingCreateInvalidJsonFailure,
  parseBookingCreateRequestPayload,
} from '@/server/bookings/create-request-payload';

const validPayload = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  restaurantSlug: 'old-crown',
  date: '2026-05-23',
  time: '18:30',
  party: '4',
  bookingType: 'dinner',
  notes: 'Window table',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '07123456789',
  marketingOptIn: 'true',
};

describe('booking create request payload parser', () => {
  it('normalizes and validates a booking create payload', () => {
    expect(parseBookingCreateRequestPayload(validPayload)).toEqual({
      kind: 'request',
      request: {
        ...validPayload,
        party: 4,
        marketingOptIn: true,
        whatsappOptIn: false,
      },
    });
  });

  it('builds the invalid JSON failure shape used by the route', () => {
    expect(buildBookingCreateInvalidJsonFailure()).toEqual({
      status: 400,
      body: { error: 'Invalid JSON payload' },
    });
  });

  it('maps invalid payloads to the shared validation failure body', () => {
    expect(parseBookingCreateRequestPayload({ ...validPayload, email: 'not-an-email' })).toEqual({
      kind: 'failure',
      failure: {
        status: 400,
        body: {
          error: expect.stringContaining('Validation failed - email:'),
          code: 'VALIDATION_FAILED',
          details: expect.objectContaining({
            fieldErrors: expect.objectContaining({
              email: expect.arrayContaining([expect.stringContaining('valid email address')]),
            }),
          }),
        },
      },
    });
  });

  it('treats non-object payloads as empty validation candidates', () => {
    const result = parseBookingCreateRequestPayload(null);

    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.failure.status).toBe(400);
      expect(result.failure.body.code).toBe('VALIDATION_FAILED');
    }
  });
});
