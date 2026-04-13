'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { BookingDialog } from '@/components/features/dashboard/booking-details/BookingDialog';
import { Button } from '@/components/ui/button';
import { BookingOfflineQueueProvider } from '@/contexts/booking-offline-queue';
import { OpsServicesProvider } from '@/contexts/ops-services';


import type { BookingService } from '@/services/ops/bookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

function createDevBookingService(): BookingService {
  // Minimal in-memory implementation for manual QA of the table assignment UI.
  let assigned: string[] = [];

  const tables = [
    {
      id: 't-12',
      tableNumber: '12',
      name: 'Window 12',
      capacity: 4,
      minPartySize: 1,
      maxPartySize: 6,
      section: 'Main',
      category: 'standard',
      seatingType: 'standard',
      mobility: 'standard',
      zoneId: 'zone-main',
      zoneActive: true,
      status: 'available',
      active: true,
      position: null,
    },
    {
      id: 't-7',
      tableNumber: '7',
      name: 'Booth 7',
      capacity: 2,
      minPartySize: 1,
      maxPartySize: 2,
      section: 'Booths',
      category: 'booth',
      seatingType: 'booth',
      mobility: 'standard',
      zoneId: 'zone-main',
      zoneActive: true,
      status: 'available',
      active: true,
      position: null,
    },
    {
      id: 't-3',
      tableNumber: '3',
      name: 'Patio 3',
      capacity: 4,
      minPartySize: 1,
      maxPartySize: 8,
      section: 'Patio',
      category: 'standard',
      seatingType: 'standard',
      mobility: 'standard',
      zoneId: 'zone-patio',
      zoneActive: true,
      status: 'available',
      active: true,
      position: null,
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unimplemented = (name: string) => async (..._args: any[]) => {
    throw new Error(`[dev][bookingService] ${name} is not implemented`);
  };

  return {
    getAssignmentContext: async (bookingId: string) => ({
      booking: {
        id: bookingId,
        restaurant_id: 'rest-dev',
        start_at: null,
        booking_date: '2026-02-10',
        start_time: '19:00',
        party_size: 4,
        status: 'confirmed',
      },
      tables,
      bookingAssignments: assigned,
      conflicts: [
        {
          tableId: 't-3',
          bookingId: 'other-booking',
          startAt: '2026-02-10T19:15:00Z',
          endAt: '2026-02-10T20:15:00Z',
          status: 'confirmed',
        },
      ],
      window: { startAt: '18:00', endAt: '22:00' },
      serverNow: new Date().toISOString(),
      holds: [],
    }),

    assignTablesDirect: async (input: {
      bookingId: string;
      tableIds: string[];
      idempotencyKey: string;
      requireAdjacency?: boolean;
    }) => {
      const { bookingId, tableIds } = input;
      assigned = tableIds.slice();
      const totalCapacity = tables
        .filter((t) => assigned.includes(t.id))
        .reduce((sum, t) => sum + t.capacity, 0);

      return {
        success: true,
        assignments: tableIds.map((tableId) => ({
          id: `assign-${tableId}`,
          booking_id: bookingId,
          table_id: tableId,
          assigned_at: new Date().toISOString(),
          assigned_by: null,
        })),
        booking: { id: bookingId, status: 'confirmed', party_size: 4 },
        summary: {
          tableCount: tableIds.length,
          totalCapacity,
          partySize: 4,
          slack: totalCapacity - 4,
        },
      };
    },

    unassignTablesDirect: async (input: { bookingId: string; tableIds: string[] }) => {
      const { tableIds } = input;
      assigned = assigned.filter((id) => !tableIds.includes(id));
      return { success: true, removedCount: tableIds.length };
    },

    autoQuoteTables: async () => ({
      holdId: null,
      expiresAt: null,
      window: null,
      candidate: {
        tableIds: ['t-12'],
        tableNumbers: ['12'],
        totalCapacity: 4,
        tableCount: 1,
        slack: 0,
        adjacencyStatus: 'single',
      },
      alternates: [],
      nextTimes: [],
      reason: null,
      zoneId: null,
      requireAdjacency: false,
      serviceFallback: { usedFallback: false, fallbackService: null },
    }),

    getBookingEmailDeliveryLog: unimplemented('getBookingEmailDeliveryLog'),
    getBookingSmsDeliveryLog: unimplemented('getBookingSmsDeliveryLog'),
    getTodaySummary: unimplemented('getTodaySummary'),
    getBookingHeatmap: unimplemented('getBookingHeatmap'),
    getRejectionAnalytics: unimplemented('getRejectionAnalytics'),
    getStrategicSettings: unimplemented('getStrategicSettings'),
    updateStrategicSettings: unimplemented('updateStrategicSettings'),
    listBookings: unimplemented('listBookings'),
    listDisabledAssignments: unimplemented('listDisabledAssignments'),
    updateBooking: unimplemented('updateBooking'),
    checkInBooking: unimplemented('checkInBooking'),
    checkOutBooking: unimplemented('checkOutBooking'),
    markNoShowBooking: unimplemented('markNoShowBooking'),
    undoNoShowBooking: unimplemented('undoNoShowBooking'),
    getStatusSummary: unimplemented('getStatusSummary'),
    getBookingHistory: unimplemented('getBookingHistory'),
    getBooking: unimplemented('getBooking'),
    getRestaurantEmailDeliveryFeed: unimplemented('getRestaurantEmailDeliveryFeed'),
    cancelBooking: unimplemented('cancelBooking'),
    createWalkInBooking: unimplemented('createWalkInBooking'),
    assignTable: unimplemented('assignTable'),
    unassignTable: unimplemented('unassignTable'),
    confirmHoldAssignment: unimplemented('confirmHoldAssignment'),
    getManualAssignmentContext: unimplemented('getManualAssignmentContext'),
  } as unknown as BookingService;
}

export function OpsBookingDialogDevHarness() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
    [],
  );

  const servicesFactories = useMemo(
    () => ({
      bookingService: () => createDevBookingService(),
    }),
    [],
  );

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
      meta: {
        date: '2026-02-10',
        timezone: 'Europe/London',
        restaurantId: 'rest-dev',
      },
      date: '2026-02-10',
      timezone: 'Europe/London',
      restaurantId: 'rest-dev',
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
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider factories={servicesFactories}>
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
      </OpsServicesProvider>
    </QueryClientProvider>
  );
}
