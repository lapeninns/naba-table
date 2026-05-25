import { describe, expect, it } from 'vitest';

import { OPS_LISTABLE_STATUSES } from '@/components/features/bookings/opsBookingsConstants';
import {
  buildOpsBookingsTableFilterChips,
  buildOpsBookingsListFilters,
  buildOpsBookingsStatusFilterOptions,
  buildOpsBookingsToggledStatuses,
  buildOpsBookingsUpdatedSearchParams,
  clampOpsBookingsWindowMinutes,
  DEFAULT_OPS_BOOKINGS_FILTER,
  filterVisibleOpsBookingsStatuses,
  getOpsBookingsBasePath,
  parseOpsBookingsStatusesParam,
  resolveOpsBookingsAppliedDateRange,
  resolveOpsBookingsDate,
  resolveOpsBookingsInitialStatuses,
  resolveOpsBookingsRestaurantName,
  resolveOpsBookingsStatusFilter,
  resolveOpsBookingsTime,
  resolveOpsBookingsView,
  resolveOpsBookingsWindowMinutes,
  resolveOpsBookingsWindowMode,
  shouldShowOpsBookingsReset,
} from '@/components/features/bookings/opsBookingsQueryDomain';

describe('opsBookingsQueryDomain', () => {
  it('resolves page chrome labels for restaurant and table filters', () => {
    expect(
      resolveOpsBookingsRestaurantName({
        accountRestaurantName: 'Account Restaurant',
        activeMembershipRestaurantName: 'Active Restaurant',
      }),
    ).toBe('Active Restaurant');
    expect(
      resolveOpsBookingsRestaurantName({
        accountRestaurantName: null,
        activeMembershipRestaurantName: null,
      }),
    ).toBe('This restaurant');

    expect(
      buildOpsBookingsTableFilterChips({
        resolvedTableLabel: 'Table 12',
        resolvedTime: '19:00',
        resolvedWindowMinutes: 45,
        resolvedWindowMode: 'window',
      }),
    ).toEqual([
      { key: 'table', label: 'Table 12', variant: 'outline' },
      { key: 'time', label: '19:00', variant: 'secondary' },
      { key: 'window', label: 'Nearby ±45m', variant: 'secondary' },
    ]);

    expect(
      buildOpsBookingsTableFilterChips({
        resolvedTableLabel: null,
        resolvedTime: null,
        resolvedWindowMinutes: 90,
        resolvedWindowMode: 'day',
      }),
    ).toEqual([
      { key: 'table', label: 'Table filter', variant: 'outline' },
      { key: 'window', label: 'All day', variant: 'secondary' },
    ]);
  });

  it('resolves base paths and sanitized date/time params', () => {
    expect(getOpsBookingsBasePath('/app/bookings')).toBe('/app');
    expect(getOpsBookingsBasePath('/bookings')).toBe('');
    expect(resolveOpsBookingsDate(new URLSearchParams('date=2026-05-20'), null)).toBe('2026-05-20');
    expect(resolveOpsBookingsDate(new URLSearchParams('date=not-a-date'), '2026-05-21')).toBeNull();
    expect(resolveOpsBookingsTime(new URLSearchParams('time=19:30'), null)).toBe('19:30');
    expect(resolveOpsBookingsTime(new URLSearchParams('time=99:99'), '18:00')).toBeNull();
  });

  it('parses statuses from URL params with fallback filtering', () => {
    expect(
      parseOpsBookingsStatusesParam('confirmed,unknown,no_show', OPS_LISTABLE_STATUSES, [
        'pending',
      ]),
    ).toEqual(['confirmed', 'no_show']);

    expect(
      resolveOpsBookingsInitialStatuses({
        initialStatuses: ['confirmed', 'cancelled'],
        listableStatuses: ['confirmed'],
        params: new URLSearchParams(),
      }),
    ).toEqual(['confirmed']);
  });

  it('resolves status filters from query params, initial filters, and date defaults', () => {
    expect(
      resolveOpsBookingsStatusFilter({
        initialDate: null,
        initialFilter: null,
        listableStatuses: OPS_LISTABLE_STATUSES,
        params: new URLSearchParams(),
      }),
    ).toBe(DEFAULT_OPS_BOOKINGS_FILTER);
    expect(
      resolveOpsBookingsStatusFilter({
        initialDate: '2026-05-20',
        initialFilter: null,
        listableStatuses: OPS_LISTABLE_STATUSES,
        params: new URLSearchParams(),
      }),
    ).toBe('all');
    expect(
      resolveOpsBookingsStatusFilter({
        initialDate: null,
        initialFilter: 'past',
        listableStatuses: OPS_LISTABLE_STATUSES,
        params: new URLSearchParams('filter=confirmed'),
      }),
    ).toBe('confirmed');
  });

  it('resolves window mode and minutes with URL precedence and bounds', () => {
    expect(
      resolveOpsBookingsWindowMode({
        initialWindowMode: null,
        params: new URLSearchParams(),
        resolvedTableId: 'table-1',
        resolvedTime: '18:00',
      }),
    ).toBe('window');
    expect(
      resolveOpsBookingsWindowMode({
        initialWindowMode: 'day',
        params: new URLSearchParams('windowMode=window'),
        resolvedTableId: null,
        resolvedTime: null,
      }),
    ).toBe('window');
    expect(
      resolveOpsBookingsWindowMinutes({
        initialWindowMinutes: 60,
        params: new URLSearchParams('windowMinutes=500'),
      }),
    ).toBe(60);
    expect(
      resolveOpsBookingsWindowMinutes({
        initialWindowMinutes: 60,
        params: new URLSearchParams('windowMinutes=45'),
      }),
    ).toBe(45);
  });

  it('clamps and resolves applied date ranges for day and window modes', () => {
    expect(clampOpsBookingsWindowMinutes(5)).toBe(15);
    expect(clampOpsBookingsWindowMinutes(500)).toBe(240);
    expect(clampOpsBookingsWindowMinutes(null)).toBe(90);

    expect(
      resolveOpsBookingsAppliedDateRange({
        selectedDate: '2026-05-20',
        resolvedTime: null,
        resolvedWindowMode: 'day',
        resolvedWindowMinutes: 60,
        restaurantTimezone: 'UTC',
      }),
    ).toMatchObject({
      date: '2026-05-20',
      from: '2026-05-20T00:00:00.000Z',
      to: '2026-05-21T00:00:00.000Z',
    });

    expect(
      resolveOpsBookingsAppliedDateRange({
        selectedDate: '2026-05-20',
        resolvedTime: '18:00',
        resolvedWindowMode: 'window',
        resolvedWindowMinutes: 90,
        restaurantTimezone: 'UTC',
      }),
    ).toMatchObject({
      date: '2026-05-20',
      from: '2026-05-20T16:30:00.000Z',
      to: '2026-05-20T19:30:00.000Z',
    });
  });

  it('builds list filters and status filter options for data-state hooks', () => {
    const filters = buildOpsBookingsListFilters({
      restaurantId: 'restaurant-1',
      view: 'upcoming',
      appliedDateRange: {
        date: '2026-05-20',
        from: '2026-05-20T00:00:00.000Z',
        to: '2026-05-21T00:00:00.000Z',
        timezone: 'UTC',
      },
      now: new Date('2026-05-20T12:00:00.000Z'),
      deferredSearch: ' Alex ',
      visibleSelectedStatuses: ['confirmed'],
      resolvedTableId: 'table-1',
    });

    expect(filters).toMatchObject({
      restaurantId: 'restaurant-1',
      pageSize: 50,
      tableId: 'table-1',
      query: 'Alex',
      statuses: ['confirmed'],
      from: '2026-05-20T12:00:00.000Z',
      to: '2026-05-21T00:00:00.000Z',
    });

    expect(
      buildOpsBookingsListFilters({
        restaurantId: null,
        view: 'upcoming',
        appliedDateRange: null,
        now: new Date('2026-05-20T12:00:00.000Z'),
        deferredSearch: '',
        visibleSelectedStatuses: [],
        resolvedTableId: null,
      }),
    ).toBeNull();

    expect(
      buildOpsBookingsStatusFilterOptions({
        listableStatuses: ['pending', 'confirmed'],
        totals: { confirmed: 3 },
      }),
    ).toEqual([
      { status: 'pending', count: 0 },
      { status: 'confirmed', count: 3 },
    ]);
  });

  it('builds URL search updates while removing legacy pagination and empty params', () => {
    const next = new URLSearchParams(
      buildOpsBookingsUpdatedSearchParams({
        currentSearch: 'debug=1&page=3&pageSize=50&status=confirmed&query=Alex',
        updates: {
          query: '',
          date: '2026-05-20',
        },
      }),
    );

    expect(next.get('debug')).toBe('1');
    expect(next.has('page')).toBe(false);
    expect(next.has('pageSize')).toBe(false);
    expect(next.has('status')).toBe(false);
    expect(next.has('query')).toBe(false);
    expect(next.get('date')).toBe('2026-05-20');
  });

  it('derives visible statuses, toggled statuses, view, and reset visibility', () => {
    expect(filterVisibleOpsBookingsStatuses(['confirmed', 'cancelled'], ['confirmed'])).toEqual([
      'confirmed',
    ]);
    expect(
      buildOpsBookingsToggledStatuses({
        status: 'confirmed',
        visibleSelectedStatuses: ['confirmed', 'no_show'],
      }),
    ).toEqual(['no_show']);
    expect(
      buildOpsBookingsToggledStatuses({
        status: 'confirmed',
        visibleSelectedStatuses: ['no_show'],
      }),
    ).toEqual(['no_show', 'confirmed']);
    expect(resolveOpsBookingsView({ defaultView: 'upcoming', statusFilter: 'confirmed' })).toBe(
      'upcoming',
    );
    expect(
      shouldShowOpsBookingsReset({
        focusBookingId: null,
        resolvedTableId: null,
        resolvedTime: null,
        search: ' Alex ',
        selectedDate: null,
        statusFilter: 'upcoming',
        defaultStatusFilter: 'upcoming',
        visibleSelectedStatuses: [],
      }),
    ).toBe(true);
  });
});
