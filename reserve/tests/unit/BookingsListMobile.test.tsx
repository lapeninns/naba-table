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

  const formatDate = (iso: string) => `Date(${iso.slice(0, 10)})`;
  const formatTime = (iso: string) => `Time(${iso.slice(11, 16)})`;

  it('renders booking summary and triggers actions', async () => {
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
      />,
    );

    expect(screen.getByText('Test Bistro')).toBeInTheDocument();
    expect(screen.getByText('Date(2050-01-15)')).toBeInTheDocument();
    expect(screen.getByText('Time(18:00)')).toBeInTheDocument();
    expect(screen.getByText(/party of 4/i)).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit booking at test bistro/i }));
    await user.click(screen.getByRole('button', { name: /cancel booking at test bistro/i }));

    expect(handleEdit).toHaveBeenCalledWith(booking);
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
});
