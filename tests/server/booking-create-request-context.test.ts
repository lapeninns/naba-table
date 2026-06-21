import { describe, expect, it, vi } from 'vitest';

import { buildBookingCreateRequestContext } from '@/server/bookings/create-request-context';

function makeHeaders(entries: Record<string, string | null | undefined>) {
  return {
    get: vi.fn((name: string) => entries[name] ?? null),
  };
}

describe('booking create request context', () => {
  it('builds public API defaults and generates a request id', () => {
    const headers = makeHeaders({});

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'generated-request-id',
      }),
    ).toEqual({
      headerIdempotencyKey: null,
      clientRequestId: 'generated-request-id',
      opsEmailProvidedHeader: false,
      isOpsWalkIn: false,
      requestSource: 'api.bookings',
      bookingSource: 'api',
      bookingDetails: null,
    });
  });

  it('reuses a valid idempotency key as the client request id', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const headers = makeHeaders({
      'Idempotency-Key': ` ${uuid} `,
    });

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'unused-generated-id',
      }),
    ).toMatchObject({
      headerIdempotencyKey: uuid,
      clientRequestId: uuid,
    });
  });

  it('preserves invalid normalized idempotency keys while generating a request id', () => {
    const headers = makeHeaders({
      'Idempotency-Key': 'not-a-uuid',
    });

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'generated-request-id',
      }),
    ).toMatchObject({
      headerIdempotencyKey: 'not-a-uuid',
      clientRequestId: 'generated-request-id',
    });
  });

  it('ignores spoofable ops headers by default', () => {
    const headers = makeHeaders({
      'x-ops-walk-in': 'true',
      'x-ops-email-provided': 'true',
    });

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'staff-request-id',
      }),
    ).toMatchObject({
      opsEmailProvidedHeader: false,
      isOpsWalkIn: false,
      requestSource: 'api.bookings',
      bookingSource: 'api',
      bookingDetails: null,
    });
  });

  it('builds ops walk-in source metadata only when ops headers are trusted', () => {
    const headers = makeHeaders({
      'x-ops-walk-in': 'true',
    });

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'staff-request-id',
        trustOpsHeaders: true,
      }),
    ).toEqual({
      headerIdempotencyKey: null,
      clientRequestId: 'staff-request-id',
      opsEmailProvidedHeader: false,
      isOpsWalkIn: true,
      requestSource: 'ops.walkin',
      bookingSource: 'ops.walkin',
      bookingDetails: {
        channel: 'ops.walkin',
        created_by: 'ops.walkin',
        staff_request_id: 'staff-request-id',
      },
    });
  });

  it('keeps trusted ops email-provided flag independent from walk-in source', () => {
    const headers = makeHeaders({
      'x-ops-email-provided': 'true',
    });

    expect(
      buildBookingCreateRequestContext(headers, {
        generateRequestId: () => 'generated-request-id',
        trustOpsHeaders: true,
      }),
    ).toMatchObject({
      opsEmailProvidedHeader: true,
      isOpsWalkIn: false,
      requestSource: 'api.bookings',
      bookingDetails: null,
    });
  });
});
