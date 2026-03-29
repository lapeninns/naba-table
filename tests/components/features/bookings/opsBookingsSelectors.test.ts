import { describe, expect, it } from 'vitest';

import {
  buildOpsBookingsCardRows,
  deriveOpsBookingsData,
} from '@/components/features/bookings/opsBookingsSelectors';

import type { BookingAction } from '@/components/features/booking-state-machine';
import type { OpsBookingListItem } from '@/types/ops';

function createBookingItem(overrides: Partial<OpsBookingListItem> = {}): OpsBookingListItem {
  return {
    id: overrides.id ?? 'booking-1',
    restaurantId: overrides.restaurantId ?? 'rest-1',
    restaurantName: overrides.restaurantName ?? 'Test Restaurant',
    restaurantSlug: overrides.restaurantSlug ?? null,
    restaurantTimezone: overrides.restaurantTimezone ?? 'UTC',
    partySize: overrides.partySize ?? 4,
    startIso: overrides.startIso ?? '2026-03-29T18:00:00.000Z',
    endIso: overrides.endIso ?? '2026-03-29T19:30:00.000Z',
    status: overrides.status ?? 'confirmed',
    notes: 'notes' in overrides ? (overrides.notes ?? null) : null,
    customerName:
      'customerName' in overrides ? (overrides.customerName ?? null) : 'Alex Johnson',
    customerEmail:
      'customerEmail' in overrides ? (overrides.customerEmail ?? null) : 'alex@example.com',
    customerPhone:
      'customerPhone' in overrides ? (overrides.customerPhone ?? null) : '+447700900000',
    reservationIntervalMinutes: overrides.reservationIntervalMinutes ?? 15,
    reference: overrides.reference ?? 'ABC123',
    source: overrides.source ?? 'online',
    seatingPreference:
      'seatingPreference' in overrides ? (overrides.seatingPreference ?? null) : null,
    allergies: 'allergies' in overrides ? (overrides.allergies ?? null) : null,
    dietaryRestrictions:
      'dietaryRestrictions' in overrides ? (overrides.dietaryRestrictions ?? null) : null,
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? false,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
  };
}

describe('deriveOpsBookingsData', () => {
  it('builds DTOs, lookup maps, and initial snapshots in one pass', () => {
    const items = [
      createBookingItem({ id: 'booking-1', customerName: 'Alex Johnson' }),
      createBookingItem({ id: 'booking-2', customerName: null, status: 'checked_in' }),
    ];

    const result = deriveOpsBookingsData(items, 'fallback-slug');

    expect(result.bookings).toHaveLength(2);
    expect(result.bookings[0]?.restaurantSlug).toBe('fallback-slug');
    expect(result.bookingById.get('booking-1')?.customerName).toBe('Alex Johnson');
    expect(result.bookingLabelsById.get('booking-1')).toBe('Alex Johnson');
    expect(result.bookingLabelsById.has('booking-2')).toBe(false);
    expect(result.initialSnapshots).toEqual([
      { id: 'booking-1', status: 'confirmed', updatedAt: null },
      { id: 'booking-2', status: 'checked_in', updatedAt: null },
    ]);
  });
});

describe('buildOpsBookingsCardRows', () => {
  it('precomputes booking card rows with pending actions', () => {
    const { bookings } = deriveOpsBookingsData(
      [createBookingItem({ id: 'booking-1', customerName: 'Alex Johnson' })],
      'fallback-slug',
    );
    const pendingActionsByBookingId: Record<string, BookingAction | null> = {
      'booking-1': 'check-in',
    };

    const rows = buildOpsBookingsCardRows({
      bookings,
      timezone: 'UTC',
      now: new Date('2026-03-29T18:05:00.000Z'),
      pendingActionsByBookingId,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.booking.id).toBe('booking-1');
    expect(rows[0]?.actions.pendingAction).toBe('check-in');
    expect(rows[0]?.actions.disableActions).toBe(true);
    expect(rows[0]?.meta.guest.label).toBe('Alex Johnson');
  });
});
