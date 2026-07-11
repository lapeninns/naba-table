import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReservationDetailSidebar } from '@/components/features/booking/detail/ReservationDetailSidebar';

function renderSidebar(overrides: Partial<Parameters<typeof ReservationDetailSidebar>[0]> = {}) {
  const handlers = {
    handleCancel: vi.fn(),
    handleEdit: vi.fn(),
    handleRebook: vi.fn(),
  };

  const view = render(
    <ReservationDetailSidebar
      actionDisabled={false}
      canManage
      isFetching={false}
      reservationId="res-1"
      {...handlers}
      {...overrides}
    />,
  );

  return { ...handlers, ...view };
}

describe('ReservationDetailSidebar', () => {
  it('@contract fires edit, cancel, and rebook callbacks from their buttons', async () => {
    const user = userEvent.setup();
    const { handleEdit, handleCancel, handleRebook } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Modify Details' }));
    expect(handleEdit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    expect(handleCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Book Again' }));
    expect(handleRebook).toHaveBeenCalledTimes(1);
  });

  it('@contract disables modify and cancel while an action is pending', () => {
    renderSidebar({ actionDisabled: true });

    expect(screen.getByRole('button', { name: 'Modify Details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeEnabled();
  });

  it('@contract disables Book Again while fetching or when the guest cannot manage', () => {
    const { rerender } = renderSidebar({ isFetching: true });
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeDisabled();

    rerender(
      <ReservationDetailSidebar
        actionDisabled={false}
        canManage={false}
        handleCancel={vi.fn()}
        handleEdit={vi.fn()}
        handleRebook={vi.fn()}
        isFetching={false}
        reservationId="res-1"
      />,
    );
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeDisabled();
  });

  it('@contract @a11y shows a sign-in prompt with a redirect link only when the guest cannot manage', () => {
    const { rerender } = renderSidebar();
    expect(screen.queryByText('Sign in to modify this reservation.')).not.toBeInTheDocument();

    rerender(
      <ReservationDetailSidebar
        actionDisabled={false}
        canManage={false}
        handleCancel={vi.fn()}
        handleEdit={vi.fn()}
        handleRebook={vi.fn()}
        isFetching={false}
        reservationId="res-42"
      />,
    );

    expect(screen.getByText('Sign in to modify this reservation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=/guest/bookings/res-42',
    );
  });
});
