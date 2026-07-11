import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingNoShowConfirmDialog } from '@/components/features/dashboard/booking-details/components/BookingNoShowConfirmDialog';

describe('BookingNoShowConfirmDialog', () => {
  it('@contract renders nothing while closed', () => {
    render(
      <BookingNoShowConfirmDialog open={false} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract confirms the no-show from the alert dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BookingNoShowConfirmDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />);

    expect(
      screen.getByRole('alertdialog', { name: 'Mark as no-show?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm no-show' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('@contract cancel closes via onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BookingNoShowConfirmDialog open onOpenChange={onOpenChange} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
