import { describe, expect, it } from 'vitest';

import { mapOpsDashboardBookingItemToBookingDTO } from '@/utils/ops/mapOpsDashboardBookingItemToBookingDTO';

import type { OpsDashboardBookingItem } from '@/types/ops';

function createBooking(overrides: Partial<OpsDashboardBookingItem> = {}): OpsDashboardBookingItem {
  return {
    id: overrides.id ?? 'booking-1',
    status: overrides.status ?? 'confirmed',
    startTime: overrides.startTime ?? '18:00',
    endTime: overrides.endTime ?? '19:30',
    partySize: overrides.partySize ?? 4,
    customerName: overrides.customerName ?? 'Alex Example',
    customerEmail: overrides.customerEmail ?? 'alex@example.com',
    customerPhone: overrides.customerPhone ?? '+44 20 7946 0958',
    notes: overrides.notes ?? 'Anniversary table',
    reference: overrides.reference ?? 'REF-123',
    details: overrides.details ?? null,
    source: overrides.source ?? 'manual',
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? true,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
    startIso: overrides.startIso,
    endIso: overrides.endIso,
    searchText: overrides.searchText ?? 'alex example anniversary',
    displayTimeRangeLabel: overrides.displayTimeRangeLabel ?? '6:00 PM – 7:30 PM',
    displayCustomerLabel: overrides.displayCustomerLabel ?? 'Alex Example',
    displayInitials: overrides.displayInitials ?? 'AE',
    tableLabel: overrides.tableLabel ?? null,
    ...overrides,
  };
}

describe('mapOpsDashboardBookingItemToBookingDTO', () => {
  it('maps normalized dashboard items into dialog-ready booking DTOs', () => {
    const booking = createBooking({
      startIso: '2026-03-29T18:00:00.000Z',
      endIso: '2026-03-29T19:30:00.000Z',
      tableAssignments: [
        {
          groupId: 'group-1',
          capacitySum: 4,
          members: [{ tableId: 'table-1', tableNumber: '12', capacity: 4, section: 'Main' }],
        },
      ],
    });

    const dto = mapOpsDashboardBookingItemToBookingDTO(booking, {
      restaurantId: 'rest-1',
      restaurantName: 'The Old Crown Girton',
      restaurantSlug: 'old-crown-girton',
      restaurantTimezone: 'Europe/London',
      summaryDate: '2026-03-29',
    });

    expect(dto.id).toBe('booking-1');
    expect(dto.restaurantId).toBe('rest-1');
    expect(dto.restaurantName).toBe('The Old Crown Girton');
    expect(dto.restaurantSlug).toBe('old-crown-girton');
    expect(dto.restaurantTimezone).toBe('Europe/London');
    expect(dto.startIso).toBe('2026-03-29T18:00:00.000Z');
    expect(dto.endIso).toBe('2026-03-29T19:30:00.000Z');
    expect(dto.reference).toBe('REF-123');
    expect(dto.displayTimeRangeLabel).toBe('6:00 PM – 7:30 PM');
    expect(dto.tableAssignments?.[0]?.members[0]?.tableNumber).toBe('12');
  });

  it('falls back to the summary date when normalized ISO fields are absent', () => {
    const dto = mapOpsDashboardBookingItemToBookingDTO(createBooking(), {
      restaurantId: 'rest-1',
      restaurantName: 'The Old Crown Girton',
      restaurantSlug: null,
      restaurantTimezone: 'America/New_York',
      summaryDate: '2026-03-29',
    });

    expect(dto.startIso).toBe('2026-03-29T04:00:00.000Z');
    expect(dto.endIso).toBe('2026-03-29T04:00:00.000Z');
  });
});
