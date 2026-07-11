import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsBookingCardHeader } from '@/components/features/dashboard/cards/OpsBookingCardHeader';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';

const PINNED_NOW = new Date('2026-03-29T17:30:00.000Z');

function createBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: 'booking-abcdef12',
    restaurantName: 'Old Crown',
    partySize: 2,
    startIso: '2026-03-29T18:00:00.000Z',
    endIso: '2026-03-29T19:30:00.000Z',
    status: 'confirmed',
    customerName: 'Alex Example',
    customerEmail: null,
    customerPhone: null,
    notes: null,
    reservationIntervalMinutes: null,
    reference: null,
    source: null,
    seatingPreference: null,
    allergies: null,
    dietaryRestrictions: null,
    tableAssignments: [],
    requiresTableAssignment: true,
    checkedInAt: null,
    checkedOutAt: null,
    displayTimeRangeLabel: null,
    displayCustomerLabel: null,
    displayInitials: null,
    searchText: null,
    tableLabel: null,
    ...overrides,
  };
}

function buildViewModel(
  overrides: Partial<BookingDTO> = {},
  options: { highlightUrgency?: boolean; now?: Date } = {},
) {
  return buildOpsBookingCardViewModel({
    booking: createBooking(overrides),
    timezone: 'UTC',
    now: options.now ?? PINNED_NOW,
    actionsDisabled: false,
    highlightUrgency: options.highlightUrgency ?? false,
  });
}

describe('OpsBookingCardHeader', () => {
  it('@contract renders guest name, initials, and the party/date/time meta row', () => {
    const viewModel = buildViewModel({ customerName: 'Priya Patel', partySize: 5 });

    render(<OpsBookingCardHeader header={viewModel.header} isOpen={false} />);

    expect(screen.getByText('Priya Patel')).toBeInTheDocument();
    expect(screen.getByText(viewModel.header.initials)).toBeInTheDocument();
    expect(screen.getByText(viewModel.header.partySizeLabel)).toBeInTheDocument();
    expect(screen.getByText(viewModel.header.dateLabel)).toBeInTheDocument();
    expect(screen.getByText(viewModel.header.timeRangeLabel)).toBeInTheDocument();
  });

  it('@contract flags an unassigned table with the warning chip', () => {
    const viewModel = buildViewModel();

    render(
      <OpsBookingCardHeader
        header={viewModel.header}
        table={viewModel.details.table}
        isOpen={false}
      />,
    );

    expect(viewModel.details.table.state).toBe('unassigned');
    expect(screen.getByText(viewModel.details.table.label)).toBeInTheDocument();
  });

  it('@contract shows the assigned table chip when tables are allocated', () => {
    const viewModel = buildViewModel({ tableLabel: '12' });

    render(
      <OpsBookingCardHeader
        header={viewModel.header}
        table={viewModel.details.table}
        isOpen={false}
      />,
    );

    expect(viewModel.details.table.state).toBe('assigned');
    expect(screen.getByText(viewModel.details.table.label)).toBeInTheDocument();
  });

  it('@contract advertises hidden notes only while collapsed', () => {
    const viewModel = buildViewModel({ notes: 'Window seat please' });

    const { rerender } = render(<OpsBookingCardHeader header={viewModel.header} isOpen={false} />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('available. Expand details to read.')).toBeInTheDocument();

    rerender(<OpsBookingCardHeader header={viewModel.header} isOpen />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('@contract surfaces the late-arrival urgency badge', () => {
    // 20 minutes past the 18:00 start → destructive "20m late" badge.
    const viewModel = buildViewModel(
      {},
      { highlightUrgency: true, now: new Date('2026-03-29T18:20:00.000Z') },
    );

    render(<OpsBookingCardHeader header={viewModel.header} isOpen={false} />);

    expect(viewModel.header.urgency).not.toBeNull();
    expect(screen.getByText('20m late')).toBeInTheDocument();
  });
});
