import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CancelBookingDialog } from '@/components/dashboard/CancelBookingDialog';
import {
  useCancelBooking,
  type CancelBookingInput,
  type CancelBookingResponse,
  type CancelContext,
} from '@/hooks/useCancelBooking';

import type { BookingDTO } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';
import type { UseMutationResult } from '@tanstack/react-query';

vi.mock('@/hooks/useCancelBooking');
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const booking: BookingDTO = {
  id: 'booking-1',
  restaurantName: 'Test Restaurant',
  partySize: 2,
  startIso: '2025-01-15T18:00:00.000Z',
  endIso: '2025-01-15T20:00:00.000Z',
  status: 'confirmed',
  notes: null,
};

const mockUseCancelBooking = vi.mocked(useCancelBooking);

const asMutationResult = (
  value: Partial<
    UseMutationResult<CancelBookingResponse, HttpError, CancelBookingInput, CancelContext>
  >,
) =>
  value as unknown as UseMutationResult<
    CancelBookingResponse,
    HttpError,
    CancelBookingInput,
    CancelContext
  >;

describe('CancelBookingDialog', () => {
  let mutateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mutateSpy = vi.fn().mockResolvedValue({ id: booking.id, status: 'cancelled' });
    mockUseCancelBooking.mockReturnValue(
      asMutationResult({
        mutateAsync: mutateSpy,
        isPending: false,
        error: null,
      }),
    );
  });

  it('calls cancel mutation when confirming', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CancelBookingDialog booking={booking} open onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByRole('button', { name: /cancel booking/i });
    await user.click(cancelButton);

    expect(mutateSpy).toHaveBeenCalledWith({ id: booking.id });
    await screen.findByText(/cancel this booking/i);
  });

  it('shows mapped server error message', async () => {
    const error: HttpError = {
      name: 'HttpError',
      status: 403,
      code: 'FORBIDDEN',
      message: 'Forbidden',
    };

    mutateSpy = vi.fn().mockRejectedValue(error);
    mockUseCancelBooking.mockReturnValue(
      asMutationResult({
        mutateAsync: mutateSpy,
        isPending: false,
        error,
      }),
    );

    const user = userEvent.setup();

    render(<CancelBookingDialog booking={booking} open onOpenChange={() => {}} />);

    const cancelButton = screen.getByRole('button', { name: /cancel booking/i });
    await user.click(cancelButton);

    expect(
      await screen.findByText('You don’t have permission to cancel this booking.'),
    ).toBeInTheDocument();
  });
});
