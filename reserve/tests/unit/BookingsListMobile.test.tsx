import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BookingsListMobile } from '@/components/dashboard/BookingsListMobile';

import type { BookingDTO } from '@/hooks/useBookings';

describe('BookingsListMobile', () => {
  const booking: BookingDTO = {
    id: 'booking-1',
    restaurantName: 'Test Bistro',
    partySize: 4,
    startIso: '2050-01-15T18:00:00.000Z',
    endIso: '2050-01-15T20:00:00.000Z',
    status: 'confirmed',
    notes: 'Birthday dinner',
  };

  const opsBooking: BookingDTO = {
    id: 'booking-ops',
    restaurantName: 'Ops Bistro',
    partySize: 2,
    startIso: '2050-01-20T17:30:00.000Z',
    endIso: '2050-01-20T19:00:00.000Z',
    status: 'pending',
    notes: null,
    customerName: 'Priya Sharma',
    customerEmail: 'priya@example.com',
  };

  const formatDate = (iso: string) => `Date(${iso.slice(0, 10)})`;
  const formatTime = (iso: string) => `Time(${iso.slice(11, 16)})`;

  it('renders booking summary (guest) and triggers cancel only (edit hidden)', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    const handleCancel = vi.fn();

    render(
      <BookingsListMobile
        bookings={[booking]}
        isLoading={false}
        formatDate={formatDate}
        formatTime={formatTime}
        onEdit={handleEdit}
        onCancel={handleCancel}
        allowEdit={false}
      />,
    );

    expect(screen.getByText('Test Bistro')).toBeInTheDocument();
    expect(screen.getByText('Date(2050-01-15)')).toBeInTheDocument();
    expect(screen.getByText('Time(18:00)')).toBeInTheDocument();
    expect(screen.getByText(/party of 4/i)).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    // Edit button should not be rendered for guest variant
    expect(screen.queryByRole('button', { name: /edit booking at test bistro/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /cancel booking at test bistro/i }));
    expect(handleEdit).not.toHaveBeenCalled();
    expect(handleCancel).toHaveBeenCalledWith(booking);
  });

  it('shows skeletons while loading', () => {
    render(
      <BookingsListMobile
        bookings={[booking]}
        isLoading
        formatDate={formatDate}
        formatTime={formatTime}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('booking-card-skeleton')).toHaveLength(3);
  });

  it('shows empty state when no bookings and not loading', () => {
    render(
      <BookingsListMobile
        bookings={[]}
        isLoading={false}
        formatDate={formatDate}
        formatTime={formatTime}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });

  it('renders ops variant with customer context and fallback notes', async () => {
    const handleEdit = vi.fn();
    const handleCancel = vi.fn();

    render(
      <BookingsListMobile
        bookings={[opsBooking]}
        isLoading={false}
        formatDate={formatDate}
        formatTime={formatTime}
        onEdit={handleEdit}
        onCancel={handleCancel}
        variant="ops"
      />,
    );

    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ops Bistro')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: /edit booking for priya sharma/i });
    const cancelButton = screen.getByRole('button', { name: /cancel booking for priya sharma/i });

    await userEvent.click(editButton);
    await userEvent.click(cancelButton);

    expect(handleEdit).toHaveBeenCalledWith(opsBooking);
    expect(handleCancel).toHaveBeenCalledWith(opsBooking);
  });
});
