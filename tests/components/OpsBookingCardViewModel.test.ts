import { describe, expect, it } from 'vitest';

import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';

function createBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: overrides.id ?? 'booking-1',
    restaurantName: overrides.restaurantName ?? 'Old Crown',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? '2026-03-29T18:00:00.000Z',
    endIso: overrides.endIso ?? '2026-03-29T19:30:00.000Z',
    status: overrides.status ?? 'confirmed',
    customerName: overrides.customerName ?? 'Alex Example',
    customerEmail: overrides.customerEmail ?? null,
    customerPhone: overrides.customerPhone ?? null,
    notes: overrides.notes ?? null,
    reservationIntervalMinutes: overrides.reservationIntervalMinutes ?? null,
    reference: overrides.reference ?? null,
    source: overrides.source ?? null,
    seatingPreference: overrides.seatingPreference ?? null,
    allergies: overrides.allergies ?? null,
    dietaryRestrictions: overrides.dietaryRestrictions ?? null,
    tableAssignments: overrides.tableAssignments ?? [],
    requiresTableAssignment: overrides.requiresTableAssignment ?? true,
    checkedInAt: overrides.checkedInAt ?? null,
    checkedOutAt: overrides.checkedOutAt ?? null,
    displayTimeRangeLabel: overrides.displayTimeRangeLabel ?? null,
    displayCustomerLabel: overrides.displayCustomerLabel ?? null,
    displayInitials: overrides.displayInitials ?? null,
    searchText: overrides.searchText ?? null,
    tableLabel: overrides.tableLabel ?? null,
    ...overrides,
  };
}

describe('buildOpsBookingCardViewModel', () => {
  it('reuses normalized display fields and assignment labels in the row model', () => {
    const booking = createBooking({
      customerName: 'Pat Original',
      displayCustomerLabel: 'VIP Pat',
      displayInitials: 'VP',
      displayTimeRangeLabel: '6:00 PM - 7:30 PM',
      tableAssignments: [
        {
          groupId: 'group-1',
          capacitySum: 4,
          members: [
            { tableId: 't-1', tableNumber: '12', capacity: 2, section: 'Main' },
            { tableId: 't-2', tableNumber: '14', capacity: 2, section: 'Main' },
          ],
        },
      ],
    });

    const viewModel = buildOpsBookingCardViewModel({
      booking,
      timezone: 'UTC',
      now: new Date('2026-03-29T17:30:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.meta.customerLabel).toBe('VIP Pat');
    expect(viewModel.meta.initials).toBe('VP');
    expect(viewModel.meta.timeRangeLabel).toBe('6:00 PM - 7:30 PM');
    expect(viewModel.tableLabel).toBe('12 + 14');
    expect(viewModel.disableActions).toBe(false);
    expect(viewModel.pendingAction).toBeNull();
  });

  it('precomputes urgency and pending action state for overdue bookings', () => {
    const booking = createBooking({
      startIso: '2026-03-29T18:00:00.000Z',
      endIso: '2026-03-29T19:30:00.000Z',
    });

    const viewModel = buildOpsBookingCardViewModel({
      booking,
      timezone: 'UTC',
      now: new Date('2026-03-29T18:20:00.000Z'),
      pendingAction: 'check-in',
      actionsDisabled: true,
    });

    expect(viewModel.urgency).toEqual({
      variant: 'destructive',
      label: '20m late',
    });
    expect(viewModel.pendingAction).toBe('check-in');
    expect(viewModel.disableActions).toBe(true);
  });
});
