import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditBookingDialog } from '@/components/dashboard/EditBookingDialog';
import { useUpdateBooking, type UpdateBookingInput } from '@/hooks/useUpdateBooking';

import type { ScheduleAwareTimestampPickerProps } from '@/components/features/booking-state-machine/ScheduleAwareTimestampPicker';
import type { BookingDTO } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';
import type { UseMutationResult } from '@tanstack/react-query';

vi.mock('@/hooks/useUpdateBooking');
vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const schedulePickerMock = vi.fn(
  (_props: ScheduleAwareTimestampPickerProps) => <div data-testid="schedule-picker" />,
);

vi.mock('@/components/features/booking-state-machine', () => ({
  ScheduleAwareTimestampPicker: (props: ScheduleAwareTimestampPickerProps) => schedulePickerMock(props),
}));

const booking: BookingDTO = {
  id: 'booking-1',
  restaurantId: 'rest-1',
  restaurantName: 'Test Restaurant',
  restaurantSlug: 'test-restaurant',
  restaurantTimezone: 'America/New_York',
  partySize: 2,
  startIso: '2025-01-15T18:00:00.000Z',
  endIso: '2025-01-15T20:00:00.000Z',
  status: 'confirmed',
  notes: 'Birthday dinner',
};

const mockUseUpdateBooking = vi.mocked(useUpdateBooking);
let mutateAsync: ReturnType<typeof vi.fn>;

describe('EditBookingDialog', () => {
  beforeEach(() => {
    schedulePickerMock.mockClear();
    schedulePickerMock.mockImplementation(
      (_props: ScheduleAwareTimestampPickerProps) => <div data-testid="schedule-picker" />,
    );
    mutateAsync = vi.fn().mockResolvedValue(booking);
    mockUseUpdateBooking.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
    } as unknown as UseMutationResult<BookingDTO, HttpError, UpdateBookingInput>);
  });

  it('submits derived end time when editing details', async () => {
    const user = userEvent.setup();

    render(<EditBookingDialog booking={booking} open onOpenChange={() => {}} />);

    const partyInput = screen.getByLabelText('Party size');
    fireEvent.change(partyInput, { target: { value: '3' } });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: booking.id,
        startIso: booking.startIso,
        endIso: booking.endIso,
        partySize: 3,
      }),
    );

    expect(schedulePickerMock).toHaveBeenCalled();
    const pickerProps = schedulePickerMock.mock.calls.at(-1)?.[0] as ScheduleAwareTimestampPickerProps;
    expect(pickerProps.restaurantSlug).toBe('test-restaurant');
    expect(pickerProps.disabled).toBe(false);
    expect(pickerProps.timeScrollArea).toBe(true);
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
    } as unknown as UseMutationResult<BookingDTO, HttpError, UpdateBookingInput>);

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

  it('disables editing when restaurant slug is missing', async () => {
    render(
      <EditBookingDialog
        booking={{ ...booking, restaurantSlug: null }}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(
      screen.getByText("We're missing the restaurant information needed to load availability. Please refresh or contact support before trying again."),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^unavailable$/i })).toBeDisabled();

    expect(schedulePickerMock).toHaveBeenCalled();
    const guardProps = schedulePickerMock.mock.calls.at(-1)?.[0] as ScheduleAwareTimestampPickerProps;
    expect(guardProps.restaurantSlug).toBeNull();
    expect(guardProps.disabled).toBe(true);
    expect(guardProps.timeScrollArea).toBe(true);
  });

  it('re-disables saving when the picker clears its value', async () => {
    let latestPickerProps: ScheduleAwareTimestampPickerProps | null = null;

    schedulePickerMock.mockImplementation((props: ScheduleAwareTimestampPickerProps) => {
      latestPickerProps = props;
      return <div data-testid="schedule-picker" />;
    });

    render(<EditBookingDialog booking={booking} open onOpenChange={() => {}} />);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    const partyInput = screen.getByLabelText('Party size');

    fireEvent.change(partyInput, { target: { value: '3' } });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    expect(latestPickerProps).not.toBeNull();
    await act(async () => {
      latestPickerProps?.onChange(null);
    });

    await waitFor(() => {
      expect(latestPickerProps?.errorMessage).toBe('Select a start time');
    });
    await waitFor(() => expect(saveButton).toBeDisabled());

    await act(async () => {
      latestPickerProps?.onChange('2025-01-16T18:30:00.000Z');
    });
    await waitFor(() => expect(saveButton).not.toBeDisabled());
    await waitFor(() => {
      expect(latestPickerProps?.errorMessage).toBeNull();
    });
  });
});
