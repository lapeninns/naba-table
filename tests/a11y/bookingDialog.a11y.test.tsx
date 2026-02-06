import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@src/types/ops';

expect.extend({ toHaveNoViolations });

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

// Force the Dialog variant (desktop) so this test stays stable and avoids Sheet-specific a11y variance.
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

describe('BookingDialog accessibility', () => {
  it('has no axe violations for the desktop dialog shell', async () => {
    const queryClient = createTestQueryClient();
    const QueryWrapper = createQueryWrapper(queryClient);

    const { BookingDialog } = await import(
      '@src/components/features/dashboard/booking-details/BookingDialog'
    );

    const booking: OpsTodayBooking = {
      id: 'booking-1',
      status: 'confirmed',
      startTime: '19:00',
      endTime: '20:30',
      partySize: 4,
      customerName: 'Alex Johnson',
      customerEmail: 'alex@example.com',
      customerPhone: '+447700900123',
      notes: 'Window seat if possible.',
      reference: 'ABC123',
      details: null,
      source: 'phone',
      loyaltyTier: null,
      loyaltyPoints: null,
      profileNotes: null,
      allergies: ['Nuts'],
      dietaryRestrictions: ['Vegetarian'],
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
    };

    const summary: OpsTodayBookingsSummary = {
      date: '2026-02-10',
      timezone: 'Europe/London',
      restaurantId: 'rest-1',
      totals: {
        total: 1,
        confirmed: 1,
        completed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 1,
        covers: 4,
      },
      bookings: [booking],
    };

    render(
      <QueryWrapper>
        <BookingDialog
          booking={booking}
          summary={summary}
          allowTableAssignments={false}
          open={true}
          onOpenChange={vi.fn()}
          onCheckIn={vi.fn(async () => {})}
          onCheckOut={vi.fn(async () => {})}
          onMarkNoShow={vi.fn(async () => {})}
          onUndoNoShow={vi.fn(async () => {})}
          onCancel={vi.fn(async () => {})}
          pendingLifecycleAction={null}
          cancelPending={false}
          isToday={true}
        />
      </QueryWrapper>,
    );

    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});

