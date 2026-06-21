import { describe, expect, it } from 'vitest';

import {
  coerceMyBookingsIsoDateRange,
  getMyBookingsRawQuery,
  parseMyBookingsQuery,
} from '@/server/bookings/my-bookings-query';

describe('my bookings query parsing', () => {
  it('normalizes missing optional params and applies pagination defaults', () => {
    const result = parseMyBookingsQuery(new URLSearchParams({ me: '1' }));

    expect(result).toEqual({
      ok: true,
      query: {
        me: '1',
        sort: 'asc',
        page: 1,
        pageSize: 10,
        offset: 0,
        fromIso: undefined,
        toIso: undefined,
      },
    });
  });

  it('parses filters, dates, sorting, and pagination offset', () => {
    const result = parseMyBookingsQuery(
      new URLSearchParams({
        me: '1',
        status: 'active',
        from: '2026-05-23T10:15:00+01:00',
        to: '2026-05-24T00:00:00+01:00',
        sort: 'desc',
        page: '3',
        pageSize: '20',
        restaurantId: '11111111-1111-4111-8111-111111111111',
      }),
    );

    expect(result).toEqual({
      ok: true,
      query: {
        me: '1',
        status: 'active',
        from: '2026-05-23T10:15:00+01:00',
        to: '2026-05-24T00:00:00+01:00',
        sort: 'desc',
        page: 3,
        pageSize: 20,
        restaurantId: '11111111-1111-4111-8111-111111111111',
        offset: 40,
        fromIso: '2026-05-23T09:15:00.000Z',
        toIso: '2026-05-23T23:00:00.000Z',
      },
    });
  });

  it('returns validation errors for invalid schema values', () => {
    const result = parseMyBookingsQuery(
      new URLSearchParams({
        me: '0',
        status: 'completed',
        page: '0',
        pageSize: '51',
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('validation');
      expect(result.kind === 'validation' ? result.error.issues.length : 0).toBeGreaterThan(0);
    }
  });

  it('preserves the route null-to-undefined conversion for optional params', () => {
    expect(getMyBookingsRawQuery(new URLSearchParams({ me: '1' }))).toEqual({
      me: '1',
      status: undefined,
      from: undefined,
      to: undefined,
      sort: undefined,
      page: undefined,
      pageSize: undefined,
      restaurantId: undefined,
    });
  });

  it('coerces explicit date ranges to ISO strings', () => {
    expect(
      coerceMyBookingsIsoDateRange({
        from: '2026-05-23T18:30:00+01:00',
        to: '2026-05-23T21:00:00+01:00',
      }),
    ).toEqual({
      fromIso: '2026-05-23T17:30:00.000Z',
      toIso: '2026-05-23T20:00:00.000Z',
    });
  });

  it('throws during date coercion when an internally supplied date is invalid', () => {
    expect(() => coerceMyBookingsIsoDateRange({ from: 'not-a-date', to: undefined })).toThrow(
      'Invalid date',
    );
  });
});
