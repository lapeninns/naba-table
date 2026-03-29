'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getBookingTabCounts } from '@/components/features/dashboard/bookingFilters';
import { OpsDashboardHeader } from '@/components/features/dashboard/OpsDashboardHeader';
import { OpsDashboardSummarySection } from '@/components/features/dashboard/OpsDashboardSummarySection';

import { DEV_RESTAURANT_ID } from '../../_mocks/devIds';
import { createOpsDevServiceFactories } from '../../_mocks/services/devFactories';
import { OpsDevProviders } from '../../_shared/OpsDevProviders';

import type { BookingFilter } from '@/components/features/dashboard/BookingsFilterBar';
import type {
  DashboardBookingActionHandlers,
  DashboardListControls,
} from '@/components/features/dashboard/types';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { ChangeEvent } from 'react';

function buildSummary(): OpsTodayBookingsSummary {
  const date = '2026-02-10';
  const timezone = 'Europe/London';
  const bookings: OpsTodayBooking[] = [
    {
      id: 'dash-bk-1',
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
    },
    {
      id: 'dash-bk-2',
      status: 'checked_in',
      startTime: '18:30',
      endTime: '20:00',
      partySize: 2,
      customerName: 'Sam Patel',
      customerEmail: null,
      customerPhone: '+447700900999',
      notes: null,
      reference: 'DEV456',
      details: null,
      source: 'walk_in',
      profileNotes: null,
      allergies: null,
      dietaryRestrictions: null,
      seatingPreference: null,
      marketingOptIn: null,
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 4,
          members: [
            {
              tableId: 't-12',
              tableNumber: '12',
              capacity: 4,
              section: 'Main',
            },
          ],
        },
      ],
      requiresTableAssignment: false,
      checkedInAt: '2026-02-10T18:35:00Z',
      checkedOutAt: null,
    },
  ];

  return {
    meta: {
      date,
      timezone,
      restaurantId: DEV_RESTAURANT_ID,
    },
    date,
    timezone,
    restaurantId: DEV_RESTAURANT_ID,
    totals: {
      total: bookings.length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: bookings.filter((b) => b.status === 'confirmed').length,
      covers: bookings.reduce((sum, b) => sum + b.partySize, 0),
    },
    bookings,
  };
}

export function OpsDashboardDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);
  const headerSwipeRef = useRef<HTMLElement>(null);
  const initialNowIso = '2026-02-10T18:45:00.000Z';
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [sortKey, setSortKey] = useState<'time' | 'party' | 'name'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');

  const summary = useMemo(() => buildSummary(), []);
  const tabCounts = useMemo(() => {
    return getBookingTabCounts({
      summary,
      allowTableAssignments: true,
      hasAssignmentHandlers: true,
    });
  }, [summary]);

  const guestStats = useMemo(() => ({ upcoming: tabCounts.upcoming, seated: tabCounts.seated }), [tabCounts]);
  const controls = useMemo<DashboardListControls>(
    () => ({
      filter,
      tabCounts,
      searchQuery: search,
      deferredSearchQuery: search,
      sortKey,
      sortDir,
      isRefetching: false,
      onFilterChange: setFilter,
      onSearchChange: (event: ChangeEvent<HTMLInputElement>) => setSearch(event.currentTarget.value),
      onPrint: () => toast.message('Dev harness: print not implemented'),
      onSortKeyChange: setSortKey,
      onSortDirChange: setSortDir,
    }),
    [filter, search, sortDir, sortKey, tabCounts],
  );
  const bookingActions = useMemo<DashboardBookingActionHandlers>(
    () => ({
      onMarkNoShow: async (bookingId: string) => {
        toast.success(`Marked no-show: ${bookingId}`);
      },
      onUndoNoShow: async (bookingId: string) => {
        toast.success(`Undo no-show: ${bookingId}`);
      },
      onCheckIn: async (bookingId: string) => {
        toast.success(`Checked in: ${bookingId}`);
      },
      onCheckOut: async (bookingId: string) => {
        toast.success(`Checked out: ${bookingId}`);
      },
    }),
    [],
  );

  const noop = useCallback(() => {}, []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <OpsDashboardHeader
            headerSwipeRef={headerSwipeRef}
            guestStats={guestStats}
            summary={summary}
            selectedDate={summary.date}
            isRefetching={false}
            initialNowIso={initialNowIso}
            dataUpdatedAt={Date.parse(initialNowIso)}
            realtimeEnabled={false}
            realtimeHealthy={true}
            isPolling={false}
            hasSummaryError={false}
            heatmap={undefined}
            heatmapLoading={false}
            onCalendarOpenChange={noop}
            onSelectDate={() => toast.message('Dev harness: date selection disabled')}
            onShiftDate={() => toast.message('Dev harness: date shift disabled')}
            onPrevDate={() => toast.message('Dev harness: prev day disabled')}
            onNextDate={() => toast.message('Dev harness: next day disabled')}
          />

          <OpsDashboardSummarySection
            summary={summary}
            restaurantName="Dev Restaurant (Ops Harness)"
            restaurantSlug="dev-restaurant"
            controls={controls}
            bookingActions={bookingActions}
            initialNowIso={initialNowIso}
            allowTableAssignments={true}
          />
        </main>
      </div>
    </OpsDevProviders>
  );
}
