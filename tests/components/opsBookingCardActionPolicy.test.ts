import { describe, expect, it } from 'vitest';

import { buildOpsBookingCardActionPolicy } from '@/components/features/dashboard/cards/opsBookingCardActionPolicy';

import type { OpsBookingCardActionPolicyMeta } from '@/components/features/dashboard/cards/opsBookingCardActionPolicy';
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

const baseMeta: OpsBookingCardActionPolicyMeta = {
  isToday: true,
  isPastDay: false,
  isDone: false,
  isSeated: false,
  customerLabel: 'Alex Example',
  dateLabel: 'Sun, Mar 29',
  timeRangeLabel: '6:00 PM - 7:30 PM',
};

describe('buildOpsBookingCardActionPolicy', () => {
  it('builds active same-day check-in policy with edit, no-show, and cancel actions enabled', () => {
    const policy = buildOpsBookingCardActionPolicy({
      booking: createBooking({ id: 'booking-active', partySize: 4 }),
      meta: baseMeta,
      pendingAction: null,
      actionsDisabled: false,
    });

    expect(policy.bookingId).toBe('booking-active');
    expect(policy.details).toMatchObject({ id: 'details', disabled: false, valid: true });
    expect(policy.menuItems).toEqual([
      expect.objectContaining({ id: 'edit', disabled: false, valid: true }),
      expect.objectContaining({ id: 'no-show', disabled: false, valid: true }),
      expect.objectContaining({ id: 'cancel', disabled: false, valid: true }),
    ]);
    expect(policy.primary).toEqual({
      kind: 'button',
      id: 'check-in',
      label: 'Seat Guest',
      disabled: false,
      valid: true,
      pending: false,
    });
    expect(policy.noShowConfirmation.description).toEqual({
      customerLabel: 'Alex Example',
      partySize: 4,
      dateLabel: 'Sun, Mar 29',
      timeRangeLabel: '6:00 PM - 7:30 PM',
    });
  });

  it('switches primary action to check-out for seated bookings', () => {
    const policy = buildOpsBookingCardActionPolicy({
      booking: createBooking({ status: 'checked_in' }),
      meta: { ...baseMeta, isSeated: true },
      pendingAction: null,
      actionsDisabled: false,
    });

    expect(policy.primary).toMatchObject({
      kind: 'button',
      id: 'check-out',
      label: 'Finish',
      disabled: false,
    });
    expect(policy.menuItems[1]).toMatchObject({
      id: 'no-show',
      disabled: true,
      valid: false,
    });
  });

  it('locks all mutating actions while a lifecycle mutation is pending', () => {
    const policy = buildOpsBookingCardActionPolicy({
      booking: createBooking(),
      meta: baseMeta,
      pendingAction: 'check-in',
      actionsDisabled: false,
    });

    expect(policy.details.disabled).toBe(true);
    expect(policy.menuItems.every((item) => item.disabled)).toBe(true);
    expect(policy.primary).toMatchObject({
      kind: 'button',
      id: 'check-in',
      disabled: true,
      pending: true,
    });
  });

  it.each([
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['no_show', 'No show'],
  ] as const)('returns closed status policy for %s bookings', (status, label) => {
    const policy = buildOpsBookingCardActionPolicy({
      booking: createBooking({ status }),
      meta: { ...baseMeta, isDone: true },
      pendingAction: null,
      actionsDisabled: false,
    });

    expect(policy.primary).toEqual({ kind: 'status', label });
    expect(policy.menuItems).toEqual([
      expect.objectContaining({ id: 'edit', disabled: true, valid: false }),
      expect.objectContaining({ id: 'no-show', disabled: true, valid: false }),
      expect.objectContaining({ id: 'cancel', disabled: true, valid: false }),
    ]);
  });

  it('keeps future bookings editable and cancellable while disabling same-day lifecycle actions', () => {
    const policy = buildOpsBookingCardActionPolicy({
      booking: createBooking(),
      meta: { ...baseMeta, isToday: false },
      pendingAction: null,
      actionsDisabled: false,
    });

    expect(policy.menuItems).toEqual([
      expect.objectContaining({ id: 'edit', disabled: false, valid: true }),
      expect.objectContaining({ id: 'no-show', disabled: true, valid: false }),
      expect.objectContaining({ id: 'cancel', disabled: false, valid: true }),
    ]);
    expect(policy.primary).toMatchObject({
      kind: 'button',
      id: 'check-in',
      disabled: true,
      valid: false,
    });
  });
});
