import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpsCancelBookingAlertDialog } from '@/components/features/bookings/components/OpsCancelBookingAlertDialog';

function renderDialog(props: Partial<Parameters<typeof OpsCancelBookingAlertDialog>[0]> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <OpsCancelBookingAlertDialog
      open
      onOpenChange={onOpenChange}
      customerName="Ada"
      partySize={2}
      onConfirm={onConfirm}
      isPending={false}
      {...props}
    />,
  );
  return { ...utils, onOpenChange, onConfirm };
}

describe('OpsCancelBookingAlertDialog', () => {
  it('@contract confirming runs the request without closing the dialog itself', () => {
    const { onConfirm, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('@contract shows the pending state and refuses to close while the request is in flight', () => {
    const { onConfirm, onOpenChange } = renderDialog({ isPending: true });

    const action = screen.getByRole('button', { name: /Cancelling/ });
    expect(action).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep booking' })).toBeDisabled();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('@contract closes normally when idle', () => {
    const { onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Keep booking' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
