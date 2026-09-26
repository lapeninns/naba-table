import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
  IDEMPOTENCY_KEY_REUSED_CODE,
  buildIdempotencyKeyReusedResponse,
  hashIdempotencyKey,
  isCreatorKeyReplayEligible,
  isIdempotencyKeyReusedResult,
  matchesIdempotentCreatePayload,
  resolveBookingCreateOrigin,
} from '@/server/bookings/idempotency';

const HEADER_KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    booking_date: '2026-10-01',
    start_time: '19:00:00',
    party_size: 2,
    customer_id: 'customer-1',
    customer_email: 'ada@example.com',
    idempotency_key: HEADER_KEY,
    created_at: '2026-09-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('hashIdempotencyKey', () => {
  it('returns the first 12 hex chars of sha256 and never the raw key', () => {
    const expected = createHash('sha256').update(HEADER_KEY).digest('hex').slice(0, 12);
    expect(hashIdempotencyKey(HEADER_KEY)).toBe(expected);
    expect(hashIdempotencyKey(HEADER_KEY)).not.toContain(HEADER_KEY.slice(0, 8));
  });

  it('returns undefined for a missing key', () => {
    expect(hashIdempotencyKey(null)).toBeUndefined();
    expect(hashIdempotencyKey(undefined)).toBeUndefined();
    expect(hashIdempotencyKey('')).toBeUndefined();
  });
});

describe('isIdempotencyKeyReusedResult (RPC result mapping)', () => {
  it('detects the RPC error code', () => {
    expect(isIdempotencyKeyReusedResult({ error: 'IDEMPOTENCY_KEY_REUSED' })).toBe(true);
  });

  it('detects the conflict marker carried in details (unified path loses the raw code)', () => {
    expect(
      isIdempotencyKeyReusedResult({ error: 'UNKNOWN', details: { idempotencyConflict: true } }),
    ).toBe(true);
  });

  it('ignores other failures', () => {
    expect(isIdempotencyKeyReusedResult({ error: 'CAPACITY_EXCEEDED', details: {} })).toBe(false);
    expect(isIdempotencyKeyReusedResult({ error: null, details: null })).toBe(false);
    expect(isIdempotencyKeyReusedResult({ details: { idempotencyConflict: 'yes' } })).toBe(false);
  });
});

describe('buildIdempotencyKeyReusedResponse', () => {
  it('is a C1 409 with a safe message and no booking data', async () => {
    const response = buildIdempotencyKeyReusedResponse();
    expect(response.status).toBe(409);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe(IDEMPOTENCY_KEY_REUSED_CODE);
    expect(body.error).toBe(body.message);
    expect(body.retryable).toBe(false);
    expect(body).not.toHaveProperty('booking');
  });
});

describe('matchesIdempotentCreatePayload', () => {
  const payload = {
    bookingDate: '2026-10-01',
    startTime: '19:00',
    partySize: 2,
    customerId: 'customer-1',
    customerEmail: ' Ada@Example.com ',
  };

  it('matches the same salient payload (time compared to the minute, email normalised)', () => {
    expect(matchesIdempotentCreatePayload(booking(), payload)).toBe(true);
  });

  it.each([
    ['party size', { partySize: 4 }],
    ['date', { bookingDate: '2026-10-02' }],
    ['time', { startTime: '19:30' }],
    ['customer', { customerId: 'customer-2' }],
    ['email', { customerEmail: 'someone@example.com' }],
  ])('rejects a different %s', (_label, change) => {
    expect(matchesIdempotentCreatePayload(booking(), { ...payload, ...change })).toBe(false);
  });

  it('skips optional identity checks that the caller cannot provide yet', () => {
    expect(
      matchesIdempotentCreatePayload(booking({ customer_email: '' }), {
        bookingDate: '2026-10-01',
        startTime: '19:00',
        partySize: 2,
        customerEmail: 'ada@example.com',
      }),
    ).toBe(true);
  });
});

describe('resolveBookingCreateOrigin', () => {
  it('is inserted for a fresh insert', () => {
    expect(
      resolveBookingCreateOrigin({
        duplicate: false,
        recovered: false,
        headerIdempotencyKey: HEADER_KEY,
        booking: booking(),
      }),
    ).toBe('inserted');
  });

  it('is key_replay only when the booking carries the header key', () => {
    expect(
      resolveBookingCreateOrigin({
        duplicate: true,
        recovered: false,
        headerIdempotencyKey: HEADER_KEY,
        booking: booking(),
      }),
    ).toBe('key_replay');
  });

  it('is recovered for deterministic-key and signature matches', () => {
    expect(
      resolveBookingCreateOrigin({
        duplicate: true,
        recovered: false,
        headerIdempotencyKey: null,
        booking: booking({ idempotency_key: 'ba2ed9d4b28133e1283b0184b94de3ba' }),
      }),
    ).toBe('recovered');
    expect(
      resolveBookingCreateOrigin({
        duplicate: false,
        recovered: true,
        headerIdempotencyKey: HEADER_KEY,
        booking: booking({ idempotency_key: 'other-key' }),
      }),
    ).toBe('recovered');
  });
});

describe('isCreatorKeyReplayEligible (guest-auth design §4.2 key-match rule)', () => {
  const now = new Date('2026-09-27T12:10:00.000Z').getTime();

  it('accepts a uuid header key that matches a booking created within 15 minutes', () => {
    expect(
      isCreatorKeyReplayEligible({ headerIdempotencyKey: HEADER_KEY, booking: booking(), now }),
    ).toBe(true);
  });

  it('rejects non-uuid keys, mismatched keys and stale bookings', () => {
    expect(
      isCreatorKeyReplayEligible({
        headerIdempotencyKey: 'ba2ed9d4b28133e1283b0184b94de3ba',
        booking: booking({ idempotency_key: 'ba2ed9d4b28133e1283b0184b94de3ba' }),
        now,
      }),
    ).toBe(false);
    expect(
      isCreatorKeyReplayEligible({
        headerIdempotencyKey: HEADER_KEY,
        booking: booking({ idempotency_key: null }),
        now,
      }),
    ).toBe(false);
    expect(
      isCreatorKeyReplayEligible({
        headerIdempotencyKey: HEADER_KEY,
        booking: booking({ created_at: '2026-09-27T11:50:00.000Z' }),
        now,
      }),
    ).toBe(false);
    expect(
      isCreatorKeyReplayEligible({ headerIdempotencyKey: null, booking: booking(), now }),
    ).toBe(false);
  });
});
