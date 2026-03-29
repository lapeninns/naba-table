import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingCardActions } from '@/components/features/dashboard/cards/OpsBookingCardActions';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';

function makeBooking(overrides: Partial<BookingDTO> & Pick<BookingDTO, 'id'>): BookingDTO {
  return {
    id: overrides.id,
    restaurantName: overrides.restaurantName ?? 'Test Restaurant',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? new Date('2026-02-06T18:00:00.000Z').toISOString(),
    endIso: overrides.endIso ?? new Date('2026-02-06T19:30:00.000Z').toISOString(),
    status: overrides.status ?? 'confirmed',
    customerName: overrides.customerName ?? 'Alice Example',
    customerEmail: overrides.customerEmail ?? null,
    customerPhone: overrides.customerPhone ?? null,
    notes: overrides.notes ?? null,
    reference: overrides.reference ?? null,
    source: overrides.source ?? null,
    seatingPreference: overrides.seatingPreference ?? null,
    allergies: overrides.allergies ?? null,
    dietaryRestrictions: overrides.dietaryRestrictions ?? null,
    reservationIntervalMinutes: overrides.reservationIntervalMinutes ?? null,
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

function makeActions(
  bookingOverrides: Partial<BookingDTO> & Pick<BookingDTO, 'id'>,
  options: {
    pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
    actionsDisabled?: boolean;
    now?: Date;
  } = {},
) {
  const booking = makeBooking(bookingOverrides);
  return buildOpsBookingCardViewModel({
    booking,
    timezone: 'UTC',
    now: options.now ?? new Date('2026-02-06T18:00:00.000Z'),
    pendingAction: options.pendingAction ?? null,
    actionsDisabled: options.actionsDisabled ?? false,
  }).actions;
}

describe('OpsBookingCardActions no-show confirmation', () => {
  it('does not call onMarkNoShow until confirm is pressed', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        actions={makeActions({ id: 'b-1', partySize: 4, customerName: 'Alice Example' })}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    // Open menu.
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);

    // Confirm in dialog.
    await user.click(screen.getByRole('button', { name: /confirm no-show/i }));
    expect(onMarkNoShow).toHaveBeenCalledTimes(1);
    expect(onMarkNoShow).toHaveBeenCalledWith('b-1');
  });

  it('cancel closes dialog without calling onMarkNoShow', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        actions={makeActions({ id: 'b-2', customerName: 'Bob Example' })}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);
  });

  it('keeps Details enabled while a mutation is pending', () => {
    render(
      <OpsBookingCardActions
        actions={makeActions(
          { id: 'b-3', customerName: 'Casey Example' },
          { pendingAction: 'check-in', actionsDisabled: true },
        )}
      />,
    );

    expect(screen.getByRole('button', { name: /details/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /more actions/i })).toBeEnabled();
  });

  it('shows invalid done-booking actions as disabled instead of valid mutations', async () => {
    const user = userEvent.setup();

    render(
      <OpsBookingCardActions
        actions={makeActions({
          id: 'b-4',
          status: 'completed',
          customerName: 'Dana Example',
        })}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Completed');

    await user.click(screen.getByRole('button', { name: /more actions/i }));

    expect(screen.getByRole('menuitem', { name: /edit booking/i })).toHaveAttribute(
      'data-disabled',
      '',
    );
    expect(screen.getByRole('menuitem', { name: /mark no show/i })).toHaveAttribute(
      'data-disabled',
      '',
    );
    expect(screen.getByRole('menuitem', { name: /cancel booking/i })).toHaveAttribute(
      'data-disabled',
      '',
    );
  });
});
