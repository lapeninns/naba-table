import { describe, expect, it } from 'vitest';

import {
  buildBookingConflictRetryResponse,
  detectBookingCommitConflict,
  withBookingValidationErrorFields,
} from '@/server/bookings/create-error-responses';

describe('detectBookingCommitConflict', () => {
  it('finds an idempotency conflict from the carried create RPC code', () => {
    expect(
      detectBookingCommitConflict([
        { code: 'UNKNOWN', message: 'x', rpcCode: 'IDEMPOTENCY_KEY_REUSED' },
      ]),
    ).toBe('idempotency_key_reused');
  });

  it('finds a retryable booking conflict from the carried create RPC code', () => {
    expect(
      detectBookingCommitConflict([
        { code: 'CAPACITY_EXCEEDED', message: 'x', rpcCode: 'BOOKING_CONFLICT' },
      ]),
    ).toBe('booking_conflict');
  });

  it('treats a real capacity failure as a full slot, not a race', () => {
    expect(
      detectBookingCommitConflict([
        { code: 'CAPACITY_EXCEEDED', message: 'full', rpcCode: 'CAPACITY_EXCEEDED' },
      ]),
    ).toBeNull();
  });

  it('ignores ordinary validation issues', () => {
    expect(
      detectBookingCommitConflict([
        { code: 'CAPACITY_EXCEEDED', message: 'full', detail: { utilizationPercent: 100 } },
        { code: 'OUTSIDE_HOURS', message: 'closed' },
      ]),
    ).toBeNull();
  });
});

describe('buildBookingConflictRetryResponse', () => {
  it('is a retryable C1 409 with Retry-After', async () => {
    const response = buildBookingConflictRetryResponse();
    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBe('1');
    await expect(response.json()).resolves.toMatchObject({
      code: 'BOOKING_CONFLICT',
      retryable: true,
      retryAfter: 1,
    });
  });
});

describe('withBookingValidationErrorFields', () => {
  it('adds C1 error, code and message from the primary issue and keeps the legacy fields', () => {
    const body = withBookingValidationErrorFields({
      ok: false,
      issues: [
        { code: 'CAPACITY_EXCEEDED', message: 'No capacity available for the requested time.' },
      ],
      alternatives: [],
    });

    expect(body).toEqual({
      ok: false,
      issues: [
        { code: 'CAPACITY_EXCEEDED', message: 'No capacity available for the requested time.' },
      ],
      alternatives: [],
      error: 'No capacity available for the requested time.',
      code: 'CAPACITY_EXCEEDED',
      message: 'No capacity available for the requested time.',
    });
  });

  it('falls back to VALIDATION_FAILED when there is no issue', () => {
    expect(withBookingValidationErrorFields({ ok: false, issues: [] })).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Some fields need attention.',
    });
  });
});
