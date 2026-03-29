import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingCardActions } from '@/components/features/dashboard/cards/OpsBookingCardActions';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';

import type { OpsBookingCardActionsProps } from '@/components/features/dashboard/cards/OpsBookingCardActions';

function createProps(
  overrides: Partial<OpsBookingCardActionsProps> = {},
): OpsBookingCardActionsProps {
  return {
    bookingId: overrides.bookingId ?? 'booking-1',
    status: overrides.status ?? 'confirmed',
    partySize: overrides.partySize ?? 2,
    customerLabel: overrides.customerLabel ?? 'Alice Example',
    dateLabel: overrides.dateLabel ?? 'Fri, Feb 6',
    timeRangeLabel: overrides.timeRangeLabel ?? '6:00 PM – 7:30 PM',
    isDone: overrides.isDone ?? false,
    isToday: overrides.isToday ?? true,
    isPastDay: overrides.isPastDay ?? false,
    isSeated: overrides.isSeated ?? false,
    disableActions: overrides.disableActions ?? false,
    detailsDisabled: overrides.detailsDisabled ?? false,
    pendingAction: overrides.pendingAction ?? null,
    onDetails: overrides.onDetails ?? vi.fn(),
    onEdit: overrides.onEdit ?? vi.fn(),
    onCancel: overrides.onCancel ?? vi.fn(),
    onMarkNoShow: overrides.onMarkNoShow ?? vi.fn().mockResolvedValue(undefined),
    onCheckIn: overrides.onCheckIn ?? vi.fn().mockResolvedValue(undefined),
    onCheckOut: overrides.onCheckOut ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe('OpsBookingCardActions', () => {
  it('keeps Details clickable while lifecycle mutations are pending', async () => {
    const user = userEvent.setup();
    const onDetails = vi.fn();

    render(
      <OpsBookingCardActions
        {...createProps({
          onDetails,
          disableActions: true,
          detailsDisabled: false,
          pendingAction: 'check-in',
        })}
      />,
    );

    const detailsButton = screen.getByRole('button', { name: 'Details' });
    expect(detailsButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /more actions/i })).toBeDisabled();

    await user.click(detailsButton);
    expect(onDetails).toHaveBeenCalledTimes(1);
  });

  it('uses the correct primary button label and disabled state for confirmed and checked-in bookings', () => {
    const { rerender } = render(<OpsBookingCardActions {...createProps()} />);

    expect(screen.getByRole('button', { name: 'Seat Guest' })).toBeEnabled();

    rerender(
      <OpsBookingCardActions
        {...createProps({
          status: 'checked_in',
          isSeated: true,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();

    rerender(
      <OpsBookingCardActions
        {...createProps({
          isToday: false,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Seat Guest' })).toBeDisabled();
  });

  it.each([
    ['confirmed', false, 'Seat Guest'],
    ['checked_in', true, 'Finish'],
    ['completed', true, 'Completed'],
    ['cancelled', true, 'Cancelled'],
    ['no_show', true, 'No show'],
  ] as const)(
    'applies the action policy for %s bookings',
    (status, manageDisabled, statusText) => {
      render(
        <OpsBookingCardActions
          {...createProps({
            status,
            isDone: status === 'completed' || status === 'cancelled' || status === 'no_show',
            isSeated: status === 'checked_in',
          })}
        />,
      );

      const moreActions = screen.getByRole('button', { name: /more actions/i });
      if (manageDisabled) {
        expect(moreActions).toBeDisabled();
      } else {
        expect(moreActions).toBeEnabled();
      }

      if (status === 'confirmed' || status === 'checked_in') {
        expect(screen.getByRole('button', { name: statusText })).toBeInTheDocument();
      } else {
        expect(screen.getByRole('status')).toHaveTextContent(statusText);
      }
    },
  );

  it('disables mutation entry points for done bookings', () => {
    render(
      <OpsBookingCardActions
        {...createProps({
          status: 'completed',
          isDone: true,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /more actions/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Seat Guest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
  });

  it('does not call onMarkNoShow until confirm is pressed', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(
      <OpsBookingCardActions
        {...createProps({
          bookingId: 'b-1',
          partySize: 4,
          customerLabel: 'Alice Example',
          onMarkNoShow,
        })}
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
    const { rerender } = render(<OpsBookingCardActions {...createProps({ partySize: 1 })} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('1 cover on');
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    rerender(<OpsBookingCardActions {...createProps({ partySize: 3 })} />);
    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('3 covers on');
  });

  it('cancel closes the no-show dialog without calling the mutation', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    render(<OpsBookingCardActions {...createProps({ onMarkNoShow })} />);

    await user.click(screen.getByRole('button', { name: /more actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /mark no show/i }));
    await user.click(screen.getByRole('button', { name: /keep booking/i }));

    expect(onMarkNoShow).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
