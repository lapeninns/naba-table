import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { BookingDialog } from '@/components/features/dashboard/booking-details/BookingDialog';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const booking: OpsTodayBooking = {
  id: 'b-1',
  status: 'confirmed',
  startTime: '18:00',
  endTime: '19:30',
  partySize: 4,
  customerName: 'Alex Rivera',
  customerEmail: 'alex@example.com',
  customerPhone: '+1 415 555 0101',
  notes: 'Anniversary table, please.',
  reference: 'REF-123',
  details: null,
  source: 'phone',
  loyaltyTier: null,
  loyaltyPoints: null,
  profileNotes: null,
  allergies: ['Peanuts'],
  dietaryRestrictions: ['Vegetarian'],
  seatingPreference: 'window',
  marketingOptIn: null,
  tableAssignments: [],
  requiresTableAssignment: true,
  checkedInAt: null,
  checkedOutAt: null,
};

const summary: OpsTodayBookingsSummary = {
  date: '2025-12-28',
  timezone: 'UTC',
  restaurantId: 'r-1',
  totals: {
    total: 0,
    confirmed: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    noShow: 0,
    upcoming: 0,
    covers: 0,
  },
  bookings: [],
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('BookingDialog states', () => {
  beforeAll(() => {
    if (!('ResizeObserver' in globalThis)) {
      // @ts-expect-error - test polyfill
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  afterEach(() => cleanup());

  it('renders loading state', () => {
    renderWithProviders(
      <BookingDialog
        booking={null}
        summary={null}
        allowTableAssignments={false}
        isLoading
        open
        onOpenChange={() => null}
      />,
    );

    expect(document.body.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    renderWithProviders(
      <BookingDialog
        booking={null}
        summary={null}
        allowTableAssignments={false}
        errorMessage="Unable to load"
        open
        onOpenChange={() => null}
      />,
    );

    expect(screen.getByText(/Unable to load booking/i)).toBeInTheDocument();
  });

  it('renders success state', () => {
    renderWithProviders(
      <BookingDialog
        booking={booking}
        summary={summary}
        allowTableAssignments={false}
        open
        onOpenChange={() => null}
      />,
    );

    expect(screen.getAllByText(/Alex Rivera/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Covers/i).length).toBeGreaterThan(0);
  });
});
