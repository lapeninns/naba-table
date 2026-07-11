import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockDynamicDialog(props: { open?: boolean }) {
      return props.open ? <div data-testid="detail-dialog-open" /> : null;
    };
  },
}));

import { ReservationDetailView } from '@/components/features/booking/detail/ReservationDetailView';

import type {
  ReservationDisplay,
  ReservationStatusConfig,
  ReservationVenue,
} from '@/components/features/booking/detail/reservationDetailDomain';
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

const statusConfig: ReservationStatusConfig = {
  label: 'Confirmed',
  tone: 'success',
  iconKey: 'confirmed',
};

const venue: ReservationVenue = {
  name: 'Fallback Venue',
  address: '1 High Street',
  timezone: 'Europe/London',
  slug: 'the-fox',
};

type ViewProps = Parameters<typeof ReservationDetailView>[0];

function makeProps(overrides: Partial<ViewProps> = {}): ViewProps {
  return {
    actionDisabled: false,
    bookingDto: null,
    canManage: true,
    closeCancelDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    handleAddToCalendar: vi.fn(),
    handleCancel: vi.fn(),
    handleDownload: vi.fn(),
    handleEdit: vi.fn(),
    handleRebook: vi.fn(),
    handleShare: vi.fn(),
    isCancelOpen: false,
    isEditOpen: false,
    isFetching: false,
    isOnline: true,
    reservation: makeReservation(),
    reservationDisplay: display,
    reservationId: 'res-1',
    restaurantName: 'The Fox',
    shareFeedback: null,
    shareFeedbackTone: null,
    statusConfig,
    venue,
    ...overrides,
  };
}

describe('ReservationDetailView', () => {
  it('@contract @a11y renders the summary heading, reference, and status label', () => {
    render(<ReservationDetailView {...makeProps()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'The Fox' })).toBeInTheDocument();
    expect(screen.getByText('NB1234')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('@contract falls back to the venue name and a derived reference when data is missing', () => {
    render(
      <ReservationDetailView
        {...makeProps({
          restaurantName: null,
          reservation: makeReservation({ reference: undefined }),
        })}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Fallback Venue' })).toBeInTheDocument();
    // First 8 chars of the reservation id, uppercased.
    expect(screen.getByText('11111111')).toBeInTheDocument();
  });

  it('@contract shows the offline notice only while offline', () => {
    const { rerender } = render(<ReservationDetailView {...makeProps()} />);

    expect(
      screen.queryByText(/offline — some actions may be limited/i),
    ).not.toBeInTheDocument();

    rerender(<ReservationDetailView {...makeProps({ isOnline: false })} />);
    expect(screen.getByText(/offline — some actions may be limited/i)).toBeInTheDocument();
  });

  it('@contract @a11y announces share feedback in a polite live region', () => {
    render(
      <ReservationDetailView
        {...makeProps({
          shareFeedback: { variant: 'success', message: 'Link copied to clipboard.' },
          shareFeedbackTone: 'success',
        })}
      />,
    );

    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toHaveTextContent('Link copied to clipboard.');
    expect(statusRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('@contract wires the duplicated summary and mobile actions to the same handlers', async () => {
    const user = userEvent.setup();
    const props = makeProps();

    render(<ReservationDetailView {...props} />);

    // Summary sidebar and the mobile action row both expose PDF/Share buttons.
    const downloadButtons = screen.getAllByRole('button', { name: /PDF/ });
    expect(downloadButtons).toHaveLength(2);

    for (const button of downloadButtons) {
      await user.click(button);
    }
    expect(props.handleDownload).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Modify Details' }));
    expect(props.handleEdit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel Booking' }));
    expect(props.handleCancel).toHaveBeenCalledTimes(1);
  });

  it('@contract mounts a dialog only when a booking DTO exists and a dialog is open', () => {
    const bookingDto = {
      id: 'booking-1',
      restaurantName: 'The Fox',
      partySize: 2,
      startIso: '2026-07-01T17:30:00.000Z',
      endIso: '2026-07-01T19:00:00.000Z',
      status: 'confirmed',
    };

    const { rerender } = render(<ReservationDetailView {...makeProps()} />);
    expect(screen.queryByTestId('detail-dialog-open')).not.toBeInTheDocument();

    rerender(
      <ReservationDetailView
        {...makeProps({
          // Cast: the mocked dynamic dialogs only read `open`.
          bookingDto: bookingDto as never,
          isEditOpen: true,
        })}
      />,
    );
    expect(screen.getByTestId('detail-dialog-open')).toBeInTheDocument();
  });

  it('@contract renders the guest information panel exactly once alongside the sidebar', () => {
    render(<ReservationDetailView {...makeProps()} />);

    expect(screen.getAllByText('Guest Information')).toHaveLength(1);
    const panel = screen.getByText('Guest Information').closest('div') as HTMLElement;
    expect(within(panel.parentElement as HTMLElement).getByText('Guest Information')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeInTheDocument();
  });
});
