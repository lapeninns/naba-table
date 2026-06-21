import { describe, expect, it } from 'vitest';

import {
  buildBookingSummaryText,
  resolveBookingDialogActionState,
} from '@/components/features/dashboard/booking-details/bookingDialogDomain';

import type { FlattenedTable } from '@/components/features/dashboard/booking-details/utils';
import type { OpsTodayBooking } from '@/types/ops';

const baseOptions = {
  allowTableAssignments: true,
  assignedTableCount: 1,
  canCheckInBooking: true,
  hasBooking: true,
  hasCancelHandler: true,
  hasCheckInHandler: true,
  hasCheckOutHandler: true,
  hasMarkNoShowHandler: true,
  hasUndoNoShowHandler: true,
  isToday: true,
  requiresTableAssignment: false,
  status: 'confirmed',
};

describe('bookingDialogDomain action state', () => {
  it('prioritizes table assignment before lifecycle actions', () => {
    const state = resolveBookingDialogActionState({
      ...baseOptions,
      assignedTableCount: 0,
      requiresTableAssignment: true,
      status: 'checked_in',
    });

    expect(state.needsAssignment).toBe(true);
    expect(state.primaryAction).toMatchObject({
      id: 'assign-table',
      label: 'Assign table',
    });
  });

  it('resolves checkout and undo no-show lifecycle actions', () => {
    expect(
      resolveBookingDialogActionState({
        ...baseOptions,
        canCheckInBooking: false,
        status: 'checked_in',
      }).primaryAction,
    ).toMatchObject({ id: 'check-out', label: 'Complete visit' });

    expect(
      resolveBookingDialogActionState({
        ...baseOptions,
        canCheckInBooking: false,
        status: 'no_show',
      }).primaryAction,
    ).toMatchObject({ id: 'undo-no-show', label: 'Undo no-show' });
  });

  it('resolves check-in only for eligible today bookings with a handler', () => {
    expect(
      resolveBookingDialogActionState({
        ...baseOptions,
        status: 'confirmed',
      }).primaryAction,
    ).toMatchObject({ id: 'check-in', label: 'Mark arrived' });

    expect(
      resolveBookingDialogActionState({
        ...baseOptions,
        hasCheckInHandler: false,
        status: 'confirmed',
      }).primaryAction,
    ).toBeNull();
  });

  it('derives cancel and no-show eligibility from handlers and terminal statuses', () => {
    const active = resolveBookingDialogActionState({
      ...baseOptions,
      status: 'confirmed',
    });
    expect(active.canCancel).toBe(true);
    expect(active.shouldShowNoShow).toBe(true);

    const checkedIn = resolveBookingDialogActionState({
      ...baseOptions,
      status: 'checked_in',
    });
    expect(checkedIn.canCancel).toBe(false);

    const missingHandlers = resolveBookingDialogActionState({
      ...baseOptions,
      hasCancelHandler: false,
      hasMarkNoShowHandler: false,
      status: 'confirmed',
    });
    expect(missingHandlers.canCancel).toBe(false);
    expect(missingHandlers.shouldShowNoShow).toBe(false);
  });
});

const bookingFixture: OpsTodayBooking = {
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

const assignedTableRows: FlattenedTable[] = [
  {
    id: 'table-1',
    tableNumber: 'T1',
    capacity: 2,
    section: 'Main',
  },
  {
    id: 'table-2',
    tableNumber: 'T2',
    capacity: 2,
    section: 'Main',
  },
];

describe('bookingDialogDomain summary text', () => {
  it('builds copy summary text with stable field ordering and assigned table labels', () => {
    expect(
      buildBookingSummaryText({
        assignedTableRows,
        booking: bookingFixture,
        formattedDate: 'Tue 10 Feb',
        formattedEndTime: '20:30',
        formattedStartTime: '19:00',
        statusLabel: 'Confirmed',
      }),
    ).toBe(
      [
        'Booking: Alex Johnson',
        'Covers: 4',
        'Time: Tue 10 Feb 19:00 - 20:30',
        'Status: Confirmed',
        'Reference: ABC123',
        'Tables: T1, T2',
        'Phone: +447700900123',
        'Email: alex@example.com',
        'Notes: Window seat if possible.',
      ].join('\n'),
    );
  });

  it('falls back to booking id and unassigned tables while omitting empty contact fields', () => {
    expect(
      buildBookingSummaryText({
        assignedTableRows: [],
        booking: {
          ...bookingFixture,
          customerEmail: null,
          customerPhone: null,
          endTime: null,
          notes: null,
          reference: null,
        },
        formattedDate: 'Tue 10 Feb',
        formattedEndTime: '--:--',
        formattedStartTime: '19:00',
        statusLabel: 'Confirmed',
      }),
    ).toBe(
      [
        'Booking: Alex Johnson',
        'Covers: 4',
        'Time: Tue 10 Feb 19:00',
        'Status: Confirmed',
        'Reference: booking-1',
        'Tables: Unassigned',
      ].join('\n'),
    );
  });
});
