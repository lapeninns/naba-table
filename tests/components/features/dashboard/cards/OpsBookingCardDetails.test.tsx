import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsBookingCardDetails } from '@/components/features/dashboard/cards/OpsBookingCardDetails';
import { buildOpsBookingCardViewModel } from '@/components/features/dashboard/cards/opsBookingCardUtils';
import { Collapsible } from '@/components/ui/collapsible';

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

function renderDetails(overrides: Partial<BookingDTO> = {}) {
  const viewModel = buildOpsBookingCardViewModel({
    booking: createBooking(overrides),
    timezone: 'UTC',
    now: PINNED_NOW,
    actionsDisabled: false,
  });

  render(
    <Collapsible open>
      <OpsBookingCardDetails details={viewModel.details} />
    </Collapsible>,
  );

  return viewModel;
}

describe('OpsBookingCardDetails', () => {
  it('@contract renders contact details when phone and email exist', () => {
    renderDetails({
      customerPhone: '+44 7700 900123',
      customerEmail: 'alex@example.com',
    });

    expect(screen.getByText('+44 7700 900123')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('@contract falls back to the empty-contact and no-notes copy', () => {
    const viewModel = renderDetails({
      customerPhone: '   ',
      customerEmail: null,
      notes: '  ',
      reference: null,
    });

    expect(screen.getByText(viewModel.details.contact.emptyLabel)).toBeInTheDocument();
    expect(screen.getByText(viewModel.details.notes.value)).toBeInTheDocument();
    expect(screen.getByText(viewModel.details.reference.valueLabel)).toBeInTheDocument();
  });

  it('@contract warns when the booking still needs a table', () => {
    const viewModel = renderDetails();

    expect(viewModel.details.table.state).toBe('unassigned');
    expect(screen.getByText(viewModel.details.table.label)).toBeInTheDocument();
  });

  it('@contract shows the assigned table label once allocated', () => {
    const viewModel = renderDetails({ tableLabel: '7' });

    expect(viewModel.details.table.state).toBe('assigned');
    expect(screen.getByText('Table 7')).toBeInTheDocument();
  });
});
