import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';

import type { BookingDTO } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';

vi.mock('@/hooks/useUpdateBooking');
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type UpdateHookMock = {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
  error: HttpError | null;
};

const booking: BookingDTO = {
  id: 'booking-1',
  restaurantName: 'Test Restaurant',
  partySize: 2,
  startIso: '2025-01-15T18:00:00.000Z',
  endIso: '2025-01-15T20:00:00.000Z',
  status: 'confirmed',
  notes: 'Birthday dinner',
};

const mockUseUpdateBooking = vi.mocked(useUpdateBooking);

describe('EditBookingDialog', () => {
  beforeEach(() => {
    const mutateAsync = vi.fn().mockResolvedValue(booking);
    mockUseUpdateBooking.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } satisfies UpdateHookMock);
  });

  it('validates end time is after start time', async () => {
    const user = userEvent.setup();

    render(<EditBookingDialog booking={booking} open onOpenChange={() => {}} />);

    const endInput = screen.getByLabelText('End');
    fireEvent.change(endInput, { target: { value: '2025-01-15T17:00' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);

    expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
  });

  it('displays mapped server error message', async () => {
    mockUseUpdateBooking.mockReset();
    const error: HttpError = {
      name: 'HttpError',
      message: 'Raw overlap',
      status: 409,
      code: 'OVERLAP_DETECTED',
    };

    const mutateAsync = vi.fn().mockImplementation(async () => {
      throw error;
    });

    mockUseUpdateBooking.mockReturnValue({
      mutateAsync,
      isPending: false,
      error,
    } satisfies UpdateHookMock);

    const user = userEvent.setup();

    render(<EditBookingDialog booking={booking} open onOpenChange={() => {}} />);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    const partyInput = screen.getByLabelText('Party size');
    fireEvent.change(partyInput, { target: { value: '3' } });
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());

    expect(
      await screen.findByText(
        'That time overlaps an existing booking. Please choose another slot.',
      ),
    ).toBeInTheDocument();
  });
});
