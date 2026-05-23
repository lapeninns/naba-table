import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingActionButton } from '@/components/features/booking-state-machine/BookingActionButton';

import type { ComponentProps } from 'react';

const booking = {
  id: 'booking-1',
  status: 'confirmed' as const,
};

function renderActionButton(overrides: Partial<ComponentProps<typeof BookingActionButton>> = {}) {
  return render(
    <BookingActionButton
      booking={booking}
      pendingAction={null}
      onCheckIn={vi.fn()}
      onCheckOut={vi.fn()}
      onMarkNoShow={vi.fn()}
      onUndoNoShow={vi.fn()}
      {...overrides}
    />,
  );
}

describe('BookingActionButton', () => {
  it('renders primary and secondary controls for confirmed bookings', () => {
    renderActionButton();

    expect(screen.getByRole('button', { name: 'Seat Guest' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mark no show' })).toBeEnabled();
  });

  it('normalizes the no-show reason before confirming', async () => {
    const user = userEvent.setup();
    const onMarkNoShow = vi.fn().mockResolvedValue(undefined);

    renderActionButton({ onMarkNoShow });

    await user.click(screen.getByRole('button', { name: 'Mark no show' }));
    await user.type(
      await screen.findByPlaceholderText('Reason (optional)'),
      '  Guest did not arrive  ',
    );
    await user.click(screen.getByRole('button', { name: 'Mark no show' }));

    expect(onMarkNoShow).toHaveBeenCalledWith({ reason: 'Guest did not arrive' });
  });
});
