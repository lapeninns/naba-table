import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingCardActions } from '@/components/features/dashboard/cards/OpsBookingCardActions';
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
    customerName: overrides.customerName ?? 'Alice Example',
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

function createActions(
  bookingOverrides: Partial<BookingDTO> = {},
  options: {
    pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
    actionsDisabled?: boolean;
    now?: Date;
  } = {},
) {
  return buildOpsBookingCardViewModel({
    booking: createBooking(bookingOverrides),
    timezone: 'UTC',
    now: options.now ?? new Date('2026-03-29T18:00:00.000Z'),
    pendingAction: options.pendingAction ?? null,
    actionsDisabled: options.actionsDisabled ?? false,
  }).actions;
}

describe('OpsBookingCardActions', () => {
  it('locks Details and the overflow trigger while lifecycle mutations are pending', async () => {
    const user = userEvent.setup();
    const onDetails = vi.fn();

    render(
      <OpsBookingCardActions
        actions={createActions({}, { pendingAction: 'check-in', actionsDisabled: true })}
        onDetails={onDetails}
      />,
    );

    const detailsButton = screen.getByRole('button', { name: 'Details' });
    const moreActionsButton = screen.getByRole('button', { name: /more actions/i });

    expect(detailsButton).toBeDisabled();
    expect(moreActionsButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();

    await user.click(detailsButton);
    expect(onDetails).not.toHaveBeenCalled();
  });

  it('uses the correct primary button label and disabled state for confirmed and checked-in bookings', () => {
    const { rerender } = render(
      <OpsBookingCardActions actions={createActions()} />,
    );

    expect(screen.getByRole('button', { name: 'Seat Guest' })).toBeEnabled();

    rerender(
      <OpsBookingCardActions
        actions={createActions({ status: 'checked_in' })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();

    rerender(
      <OpsBookingCardActions
        actions={createActions(
          {},
          {
            now: new Date('2026-03-30T18:00:00.000Z'),
          },
        )}
      />,
    );

    expect(screen.getByRole('button', { name: 'Seat Guest' })).toBeDisabled();
  });

  it.each([
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['no_show', 'No show'],
  ] as const)('shows a closed status label for %s bookings', (status, statusText) => {
    render(
      <OpsBookingCardActions actions={createActions({ status })} />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(statusText);
  });

  it('keeps done-booking actions visible but disabled', async () => {
    const user = userEvent.setup();

    render(
      <OpsBookingCardActions actions={createActions({ status: 'completed' })} />,
    );

    expect(screen.queryByRole('button', { name: 'Seat Guest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();

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

  it('does not call onMarkNoShow until confirm is pressed', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        actions={createActions({ id: 'b-1', partySize: 4, customerName: 'Alice Example' })}
        onMarkNoShow={onMarkNoShow}
      />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));

    expect(onMarkNoShow).toHaveBeenCalledTimes(0);

    await user.click(screen.getByRole('button', { name: /confirm no-show/i }));
    expect(onMarkNoShow).toHaveBeenCalledTimes(1);
    expect(onMarkNoShow).toHaveBeenCalledWith('b-1');
  });

  it('uses singular and plural cover copy in the no-show dialog', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <OpsBookingCardActions actions={createActions({ partySize: 1 })} />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1 cover on');
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    rerender(<OpsBookingCardActions actions={createActions({ partySize: 3 })} />);
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('3 covers on');
  });

  it('cancel closes the no-show dialog without calling the mutation', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions actions={createActions()} onMarkNoShow={onMarkNoShow} />,
    );

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    expect(onMarkNoShow).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
