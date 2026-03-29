import { describe, expect, it } from 'vitest';

import { sortBookings, sortBookingsGrouped, toIsoTime } from '@/components/features/dashboard/list/utils';
import type { OpsTodayBooking } from '@/types/ops';

describe('toIsoTime', () => {
  it('returns offset-aware UTC ISO for UTC-zone values', () => {
    expect(toIsoTime('2026-03-14', '18:30', 'Europe/London')).toBe('2026-03-14T18:30:00.000Z');
  });

  it('converts local wall time to UTC ISO using restaurant timezone', () => {
    // July is BST (UTC+1) in London.
    expect(toIsoTime('2026-07-14', '18:30', 'Europe/London')).toBe('2026-07-14T17:30:00.000Z');
  });

  it('defaults missing time to midnight while preserving offset', () => {
    expect(toIsoTime('2026-02-16', null, 'UTC')).toBe('2026-02-16T00:00:00.000Z');
  });

  it('keeps fallback payloads offset-aware for malformed timezone input', () => {
    const iso = toIsoTime('2026-02-16', '09:15', 'Invalid/Zone');
    expect(iso.endsWith('Z')).toBe(true);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

function createBooking(overrides: Partial<OpsTodayBooking> = {}): OpsTodayBooking {
  return {
    id: overrides.id ?? 'booking-1',
    status: overrides.status ?? 'confirmed',
    startTime: overrides.startTime ?? '18:00',
    endTime: overrides.endTime ?? '19:30',
    partySize: overrides.partySize ?? 2,
    customerName: overrides.customerName ?? 'Alex Example',
    customerEmail: overrides.customerEmail ?? null,
    customerPhone: overrides.customerPhone ?? null,
    notes: overrides.notes ?? null,
    reference: overrides.reference ?? null,
    details: overrides.details ?? null,
    source: overrides.source ?? null,
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? true,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
    ...overrides,
  };
}

describe('dashboard booking sorting', () => {
  it('uses normalized sortTimeMs when available', () => {
    const later = createBooking({
      id: 'later',
      startTime: '20:00',
      sortTimeMs: 2_000,
    });
    const earlier = createBooking({
      id: 'earlier',
      startTime: '08:00',
      sortTimeMs: 1_000,
    });

    const result = sortBookings([later, earlier], 'time', 'asc');
    expect(result.map((booking) => booking.id)).toEqual(['earlier', 'later']);
  });

  it('uses normalized timeline sort values for the grouped all-bookings view', () => {
    const seated = createBooking({
      id: 'seated',
      status: 'checked_in',
      startTime: '18:00',
      endTime: '21:00',
      sortTimelineTimeMs: 5_000,
    });
    const upcoming = createBooking({
      id: 'upcoming',
      status: 'confirmed',
      startTime: '19:00',
      sortTimelineTimeMs: 2_000,
    });

    const result = sortBookingsGrouped([seated, upcoming], 'time', 'asc');
    expect(result.map((booking) => booking.id)).toEqual(['upcoming', 'seated']);
  });
});
