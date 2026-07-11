import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReservationHistory } from '@/components/features/booking/detail/ReservationHistory';

import type { BookingHistoryEvent } from '@/types/bookingHistory';

const { useBookingHistoryMock } = vi.hoisted(() => ({
  useBookingHistoryMock: vi.fn(),
}));

vi.mock('@/hooks/useBookingHistory', () => ({
  useBookingHistory: useBookingHistoryMock,
}));

function makeEvent(overrides: Partial<BookingHistoryEvent> = {}): BookingHistoryEvent {
  return {
    versionId: 'v-1',
    changeType: 'updated',
    changedAt: '2026-07-01T10:00:00.000Z',
    actor: 'system',
    summary: 'Booking updated',
    changes: [],
    ...overrides,
  };
}

function mockHistory(state: {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  events?: BookingHistoryEvent[];
}) {
  useBookingHistoryMock.mockReturnValue({
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
    data: state.events ? { events: state.events } : undefined,
  });
}

function renderHistory() {
  return render(<ReservationHistory reservationId="res-1" timezone="Europe/London" />);
}

describe('ReservationHistory', () => {
  it('@contract shows skeleton placeholders while loading', () => {
    mockHistory({ isLoading: true });
    const { container } = renderHistory();

    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Loading recent changes…')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('@contract surfaces the query error message when history fails to load', () => {
    mockHistory({ isError: true, error: new Error('History service down') });
    renderHistory();

    expect(screen.getByText('Unable to load history')).toBeInTheDocument();
    expect(screen.getByText('History service down')).toBeInTheDocument();
  });

  it('@contract falls back to generic error copy when the error has no message', () => {
    mockHistory({ isError: true, error: null });
    renderHistory();

    expect(screen.getByText('Please try again later.')).toBeInTheDocument();
  });

  it('@contract shows the empty state when no changes are recorded', () => {
    mockHistory({ events: [] });
    renderHistory();

    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
  });

  it('@contract renders event summaries with actor badges and formatted change values', () => {
    mockHistory({
      events: [
        makeEvent({
          versionId: 'v-1',
          actor: 'system',
          summary: 'Booking updated',
          changes: [
            { field: 'party_size', label: 'Party size', before: 2, after: 4 },
            { field: 'start_time', label: 'Start time', before: '18:30:00', after: '19:00:00' },
            { field: 'booking_date', label: 'Date', before: null, after: '2026-07-02' },
            { field: 'status', label: 'Status', before: 'pending', after: 'confirmed' },
            { field: 'seating_preference', label: 'Seating', before: 'any', after: 'window' },
          ],
        }),
      ],
    });
    renderHistory();

    expect(screen.getByText('Booking updated')).toBeInTheDocument();
    // Actor "system" is normalized to "System".
    expect(screen.getByText('System')).toBeInTheDocument();

    // party_size renders raw numbers.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    // Times are normalized to HH:MM.
    expect(screen.getByText('18:30')).toBeInTheDocument();
    expect(screen.getByText('19:00')).toBeInTheDocument();

    // Missing before values render an em dash placeholder.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // booking_date is formatted as a long date (UTC date-only, host-TZ independent).
    expect(screen.getByText(/2 July 2026/)).toBeInTheDocument();

    // Status and seating enums map to friendly labels.
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('No preference')).toBeInTheDocument();
    expect(screen.getByText('Window')).toBeInTheDocument();
  });

  it('@contract shows a fallback note for events without notable field changes', () => {
    mockHistory({
      events: [makeEvent({ actor: 'Manager Amy', changes: [] })],
    });
    renderHistory();

    expect(screen.getByText('No notable field changes recorded.')).toBeInTheDocument();
    // Non-system actors keep their given name.
    expect(screen.getByText('Manager Amy')).toBeInTheDocument();
  });
});
