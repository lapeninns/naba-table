import { describe, expect, it } from 'vitest';

import { normalizeBookingsTab } from '@src/guest/lib/validation';
import {
  GUEST_PORTAL_BOOKINGS_FILTERS,
  buildBookingsQueryKeyParams,
  buildBookingsSearchParams,
} from '@src/guest/services/bookings-params';

describe('guest booking params helpers', () => {
  it('builds default booking search params', () => {
    const params = buildBookingsSearchParams();

    expect(params.get('me')).toBe('1');
    expect(params.get('page')).toBe('1');
    expect(params.get('pageSize')).toBe('10');
  });

  it('exports the canonical guest portal bookings filter contract', () => {
    expect(GUEST_PORTAL_BOOKINGS_FILTERS).toEqual({ page: 1, pageSize: 50 });
  });

  it('includes provided filters when building search params', () => {
    const params = buildBookingsSearchParams({
      page: 2,
      pageSize: 20,
      status: 'confirmed',
      sort: 'desc',
      from: new Date('2026-02-01T12:00:00.000Z'),
      to: '2026-02-03T12:00:00.000Z',
      restaurantId: 'rest-1',
    });

    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('20');
    expect(params.get('status')).toBe('confirmed');
    expect(params.get('sort')).toBe('desc');
    expect(params.get('from')).toBe('2026-02-01T12:00:00.000Z');
    expect(params.get('to')).toBe('2026-02-03T12:00:00.000Z');
    expect(params.get('restaurantId')).toBe('rest-1');
  });

  it('normalizes bookings tab values', () => {
    expect(normalizeBookingsTab()).toBe('upcoming');
    expect(normalizeBookingsTab('history')).toBe('past');
    expect(normalizeBookingsTab('Past')).toBe('past');
  });

  it('mirrors search params when building query key params', () => {
    const filters = { page: 3, pageSize: 5, status: 'cancelled' } as const;
    const params = buildBookingsSearchParams(filters);

    expect(buildBookingsQueryKeyParams(filters)).toEqual(Object.fromEntries(params.entries()));
  });
});
