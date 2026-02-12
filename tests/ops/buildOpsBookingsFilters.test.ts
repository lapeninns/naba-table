import { describe, expect, it } from 'vitest';

import { buildOpsBookingsFilters } from '@src/utils/ops/buildOpsBookingsFilters';

describe('buildOpsBookingsFilters', () => {
  it('defaults to upcoming semantics without a scope', () => {
    const now = new Date('2026-02-06T12:00:00.000Z');
    const filters = buildOpsBookingsFilters({
      restaurantId: '00000000-0000-0000-0000-000000000000',
      view: 'upcoming',
      scope: null,
      now,
      query: '',
      selectedStatuses: [],
      tableId: null,
    });

    expect(filters.sortBy).toBe('start_at');
    expect(filters.sort).toBe('asc');
    expect(filters.from).toBe(now.toISOString());
    expect(filters.statuses).toContain('confirmed');
    expect(filters.statuses).toContain('PRIORITY_WAITLIST');
  });

  it('clamps upcoming within a scope by max(now, scope.from)', () => {
    const now = new Date('2026-02-06T12:00:00.000Z');
    const scope = {
      from: '2026-02-06T00:00:00.000Z',
      to: '2026-02-07T00:00:00.000Z',
    };

    const filters = buildOpsBookingsFilters({
      restaurantId: '00000000-0000-0000-0000-000000000000',
      view: 'upcoming',
      scope,
      now,
      query: '',
      selectedStatuses: [],
      tableId: null,
    });

    expect(filters.from).toBe('2026-02-06T12:00:00.000Z');
    expect(filters.to).toBe(scope.to);
  });

  it('clamps past within a scope by min(now, scope.to)', () => {
    const now = new Date('2026-02-06T12:00:00.000Z');
    const scope = {
      from: '2026-02-06T00:00:00.000Z',
      to: '2026-02-06T08:00:00.000Z',
    };

    const filters = buildOpsBookingsFilters({
      restaurantId: '00000000-0000-0000-0000-000000000000',
      view: 'past',
      scope,
      now,
      query: '',
      selectedStatuses: [],
      tableId: null,
    });

    expect(filters.from).toBe(scope.from);
    expect(filters.to).toBe(scope.to);
    expect(filters.sortBy).toBe('start_at');
    expect(filters.sort).toBe('desc');
  });

  it('advanced statuses override view-level status filters', () => {
    const now = new Date('2026-02-06T12:00:00.000Z');
    const filters = buildOpsBookingsFilters({
      restaurantId: '00000000-0000-0000-0000-000000000000',
      view: 'cancelled',
      scope: null,
      now,
      query: '',
      selectedStatuses: ['confirmed', 'checked_in'],
      tableId: null,
    });

    expect(filters.status).toBeUndefined();
    expect(filters.statuses).toEqual(['confirmed', 'checked_in']);
  });
});

