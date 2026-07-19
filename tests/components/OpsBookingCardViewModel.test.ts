import { describe, expect, it } from 'vitest';

import {
  buildOpsBookingCardViewModel,
  getTableLabel,
} from '@/components/features/dashboard/cards/opsBookingCardUtils';

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
  it('normalizes the booking contract and derives initials from the normalized label', () => {
    const booking = createBooking({
      customerName: '  Pat Original  ',
      customerEmail: '  vip@example.com  ',
      customerPhone: '  +447700900000  ',
      notes: '  Anniversary table please  ',
      reference: '  VIP-42  ',
      displayCustomerLabel: '  VIP Pat  ',
      displayInitials: '   ',
      displayTimeRangeLabel: '  6:00 PM - 7:30 PM  ',
      tableLabel: '  Patio 7  ',
    });

    const viewModel = buildOpsBookingCardViewModel({
      booking,
      timezone: 'UTC',
      now: new Date('2026-03-29T17:30:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.meta.guest).toEqual({
      label: 'VIP Pat',
      initials: 'VP',
      isWalkInGuest: false,
    });
    expect(viewModel.meta.timeRangeLabel).toBe('6:00 PM - 7:30 PM');
    expect(viewModel.booking.customerName).toBe('Pat Original');
    expect(viewModel.booking.customerEmail).toBe('vip@example.com');
    expect(viewModel.booking.customerPhone).toBe('+447700900000');
    expect(viewModel.booking.notes).toBe('Anniversary table please');
    expect(viewModel.booking.reference).toBe('VIP-42');
    expect(viewModel.tableLabel).toBe('Patio 7');
  });

  it('preserves explicit display initials overrides when present', () => {
    const viewModel = buildOpsBookingCardViewModel({
      booking: createBooking({
        customerName: 'John Doe',
        displayCustomerLabel: 'Dr. John Doe',
        displayInitials: ' JD ',
      }),
      timezone: 'UTC',
      now: new Date('2026-03-29T17:30:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.meta.guest).toEqual({
      label: 'Dr. John Doe',
      initials: 'JD',
      isWalkInGuest: false,
    });
    expect(viewModel.header.initials).toBe('JD');
  });

  it('marks structured Sunday Roast bookings for a visible staff chip', () => {
    const viewModel = buildOpsBookingCardViewModel({
      booking: createBooking({
        details: { occasion: 'Sunday Roast', sunday_roast: true },
      }),
      timezone: 'UTC',
      now: new Date('2026-03-29T17:30:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.header.isSundayRoast).toBe(true);
  });

  it('falls back to walk-in defaults and strips blank optional fields', () => {
    const booking = createBooking({
      customerName: '   ',
      customerEmail: '   ',
      customerPhone: '\n',
      notes: '  ',
      reference: '\t',
      displayCustomerLabel: '   ',
      displayInitials: ' ',
      displayTimeRangeLabel: ' ',
      endIso: '',
    });

    const viewModel = buildOpsBookingCardViewModel({
      booking,
      timezone: 'UTC',
      now: new Date('2026-03-29T17:30:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.meta.customerLabel).toBe('Walk-in Guest');
    expect(viewModel.meta.initials).toBe('WG');
    expect(viewModel.meta.timeRangeLabel).toBe('6:00 PM');
    expect(viewModel.booking.customerName).toBeNull();
    expect(viewModel.booking.customerEmail).toBeNull();
    expect(viewModel.booking.customerPhone).toBeNull();
    expect(viewModel.booking.notes).toBeNull();
    expect(viewModel.booking.reference).toBeNull();
  });

  it('builds canonical grouped table labels', () => {
    expect(
      getTableLabel([
        {
          groupId: 'group-1',
          capacitySum: 4,
          members: [
            { tableId: 't-1', tableNumber: '12', capacity: 2, section: 'Main' },
            { tableId: 't-2', tableNumber: '14', capacity: 2, section: 'Main' },
          ],
        },
        {
          groupId: 'group-2',
          capacitySum: 2,
          members: [{ tableId: 't-3', tableNumber: '7', capacity: 2, section: 'Bar' }],
        },
      ]),
    ).toBe('12 + 14, 7');
    expect(getTableLabel([])).toBeNull();
  });

  it('suppresses urgency when highlighting is disabled or the booking is not actionable', () => {
    const overdueBooking = createBooking();
    const completedBooking = createBooking({ status: 'completed' });

    const highlightOff = buildOpsBookingCardViewModel({
      booking: overdueBooking,
      timezone: 'UTC',
      now: new Date('2026-03-29T18:20:00.000Z'),
      actionsDisabled: false,
      highlightUrgency: false,
    });

    const doneBooking = buildOpsBookingCardViewModel({
      booking: completedBooking,
      timezone: 'UTC',
      now: new Date('2026-03-29T18:20:00.000Z'),
      actionsDisabled: false,
    });

    const futureDayBooking = buildOpsBookingCardViewModel({
      booking: createBooking({ startIso: '2026-03-30T18:00:00.000Z' }),
      timezone: 'UTC',
      now: new Date('2026-03-29T18:20:00.000Z'),
      actionsDisabled: false,
    });

    expect(highlightOff.urgency).toBeNull();
    expect(doneBooking.urgency).toBeNull();
    expect(futureDayBooking.urgency).toBeNull();
  });

  it('precomputes overdue urgency and pending action state', () => {
    const viewModel = buildOpsBookingCardViewModel({
      booking: createBooking(),
      timezone: 'UTC',
      now: new Date('2026-03-29T18:20:00.000Z'),
      pendingAction: 'check-in',
      actionsDisabled: true,
    });

    expect(viewModel.header.urgency).toEqual({
      variant: 'destructive',
      label: '20m late',
    });
    expect(viewModel.actions.details.disabled).toBe(true);
    expect(viewModel.actions.menuItems.every((item) => item.disabled)).toBe(true);
    expect(viewModel.actions.primary).toMatchObject({
      kind: 'button',
      id: 'check-in',
      disabled: true,
      pending: true,
    });
    expect(viewModel.pendingAction).toBe('check-in');
    expect(viewModel.disableActions).toBe(true);
  });

  it('marks mutating actions invalid for done bookings while keeping them visible in policy', () => {
    const booking = createBooking({
      status: 'completed',
      notes: 'Window seat',
    });

    const viewModel = buildOpsBookingCardViewModel({
      booking,
      timezone: 'UTC',
      now: new Date('2026-03-29T20:00:00.000Z'),
      actionsDisabled: false,
    });

    expect(viewModel.header.isDone).toBe(true);
    expect(viewModel.details.notes).toEqual({
      label: 'Notes',
      value: 'Window seat',
      highlighted: true,
    });
    expect(viewModel.actions.details).toMatchObject({
      id: 'details',
      disabled: false,
      valid: true,
    });
    expect(viewModel.actions.menuItems).toEqual([
      expect.objectContaining({ id: 'edit', valid: false, disabled: true }),
      expect.objectContaining({ id: 'no-show', valid: false, disabled: true }),
      expect.objectContaining({ id: 'cancel', valid: false, disabled: true }),
    ]);
    expect(viewModel.actions.primary).toEqual({
      kind: 'status',
      label: 'Completed',
    });
  });
});
