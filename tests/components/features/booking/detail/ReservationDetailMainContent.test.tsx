import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReservationDetailMainContent } from '@/components/features/booking/detail/ReservationDetailMainContent';

import type { ReservationDisplay } from '@/components/features/booking/detail/reservationDetailDomain';
import type { Reservation } from '@entities/reservation/reservation.schema';

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantName: 'The Fox',
    restaurantSlug: 'the-fox',
    restaurantTimezone: 'Europe/London',
    bookingDate: '2026-07-01',
    startTime: '18:30',
    endTime: '20:00',
    startAt: '2026-07-01T17:30:00.000Z',
    endAt: '2026-07-01T19:00:00.000Z',
    partySize: 2,
    bookingType: 'dinner',
    status: 'confirmed',
    customerName: 'Alice Example',
    customerEmail: 'alice@example.com',
    customerPhone: '+441234567890',
    marketingOptIn: false,
    whatsappOptIn: false,
    notes: null,
    reference: 'NB1234',
    clientRequestId: null,
    idempotencyKey: null,
    pendingRef: null,
    metadata: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const display: ReservationDisplay = {
  shortDate: 'Wed 1 Jul',
  fullDate: 'Wednesday, 1 July 2026',
  time: '18:30',
};

function renderMainContent(reservationOverrides: Partial<Reservation> = {}) {
  const handlers = {
    handleAddToCalendar: vi.fn(),
    handleDownload: vi.fn(),
    handleShare: vi.fn(),
  };

  const view = render(
    <ReservationDetailMainContent
      {...handlers}
      reservation={makeReservation(reservationOverrides)}
      reservationDisplay={display}
    />,
  );

  return { ...handlers, ...view };
}

describe('ReservationDetailMainContent', () => {
  it('@contract renders date, time, and party stat cards from the display model', () => {
    renderMainContent();

    expect(screen.getByText('Wed 1 Jul')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, 1 July 2026')).toBeInTheDocument();
    expect(screen.getByText('18:30')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Guests')).toBeInTheDocument();
  });

  it('@contract uses singular guest copy for a party of one', () => {
    renderMainContent({ partySize: 1 });

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('@contract renders guest contact details in the info panel', () => {
    renderMainContent();

    expect(screen.getByText('Guest Information')).toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('+441234567890')).toBeInTheDocument();
  });

  it('@contract shows the preferences panel only when the reservation has notes', () => {
    const { rerender, handleAddToCalendar, handleDownload, handleShare } = renderMainContent();

    expect(screen.queryByText('Preferences')).not.toBeInTheDocument();

    rerender(
      <ReservationDetailMainContent
        handleAddToCalendar={handleAddToCalendar}
        handleDownload={handleDownload}
        handleShare={handleShare}
        reservation={makeReservation({ notes: 'Window seat please' })}
        reservationDisplay={display}
      />,
    );

    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Window seat please')).toBeInTheDocument();
  });

  it('@contract fires the mobile action callbacks', async () => {
    const user = userEvent.setup();
    const { handleDownload, handleShare, handleAddToCalendar } = renderMainContent();

    await user.click(screen.getByRole('button', { name: /PDF/ }));
    expect(handleDownload).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Share/ }));
    expect(handleShare).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Add to calendar/ }));
    expect(handleAddToCalendar).toHaveBeenCalledTimes(1);
  });
});
