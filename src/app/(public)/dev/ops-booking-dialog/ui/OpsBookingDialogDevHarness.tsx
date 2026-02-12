'use client';

import { useMemo, useState } from 'react';

import { BookingDialog } from '@/components/features/dashboard/booking-details/BookingDialog';
import { Button } from '@/components/ui/button';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';


import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';


import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

export function OpsBookingDialogDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);

  const booking: OpsTodayBooking = useMemo(
    () => ({
      id: 'booking-dev-1',
      status: 'confirmed',
      startTime: '19:00',
      endTime: '20:30',
      partySize: 4,
      customerName: 'Alex Johnson',
      customerEmail: 'alex@example.com',
      customerPhone: '+447700900123',
      notes: 'Window seat if possible.',
      reference: 'DEV123',
      details: null,
      source: 'phone',
      profileNotes: 'Prefers quieter tables.',
      allergies: ['Nuts'],
      dietaryRestrictions: ['Vegetarian'],
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    }),
    [],
  );

  const summary: OpsTodayBookingsSummary = useMemo(
    () => ({
      date: '2026-02-10',
      timezone: 'Europe/London',
      restaurantId: DEV_RESTAURANT_ID,
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
    }),
    [booking],
  );

  const [open, setOpen] = useState(true);

  return (
    <OpsDevProviders factories={factories}>
      <BookingOfflineQueueProvider>
        <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-50 p-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-900">Dev harness</div>
              <div className="text-xs text-slate-600">
                Ops BookingDialog and TableAssignmentPanel (mock services)
              </div>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Open dialog
            </Button>
          </div>

          <BookingDialog
            booking={booking}
            summary={summary}
            allowTableAssignments={true}
            open={open}
            onOpenChange={setOpen}
            onCheckIn={async () => {}}
            onCheckOut={async () => {}}
            onMarkNoShow={async () => {}}
            onUndoNoShow={async () => {}}
            onCancel={async () => {}}
            pendingLifecycleAction={null}
            cancelPending={false}
            isToday={true}
          />
        </div>
      </BookingOfflineQueueProvider>
    </OpsDevProviders>
  );
}
