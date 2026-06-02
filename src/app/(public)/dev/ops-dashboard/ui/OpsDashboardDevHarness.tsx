'use client';

import { DateTime } from 'luxon';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { getBookingTabCounts } from '@/components/features/dashboard/bookingFilters';
import { OpsDashboardHeader } from '@/components/features/dashboard/OpsDashboardHeader';
import { OpsDashboardSummarySection } from '@/components/features/dashboard/OpsDashboardSummarySection';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';

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

const DEV_TIMEZONE = 'Europe/London';
const DEV_NOW_TIME = '18:45';

function getDevServiceDate() {
  return DateTime.now().setZone(DEV_TIMEZONE).toISODate() ?? '2026-02-10';
}

function toDevBookingIso(date: string, time: string) {
  return (
    DateTime.fromISO(`${date}T${time}`, { zone: DEV_TIMEZONE })
      .toUTC()
      .toISO({ suppressMilliseconds: false }) ?? `${date}T${time}:00.000Z`
  );
}

function buildSummaryFromBookings(date: string, bookings: OpsTodayBooking[]): OpsTodayBookingsSummary {
  const timezone = DEV_TIMEZONE;

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
      completed: bookings.filter((b) => b.status === 'completed').length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      noShow: bookings.filter((b) => b.status === 'no_show').length,
      upcoming: bookings.filter((b) => b.status === 'confirmed').length,
      covers: bookings.reduce((sum, b) => sum + b.partySize, 0),
    },
    bookings,
  };
}

function getCurrentDevIso() {
  return DateTime.now().setZone(DEV_TIMEZONE).toUTC().toISO({ suppressMilliseconds: false });
}

function buildSummary(date: string): OpsTodayBookingsSummary {
  const bookings: OpsTodayBooking[] = [
    {
      id: 'dash-bk-1',
      status: 'confirmed',
      startTime: '19:00',
      endTime: '20:30',
      startIso: toDevBookingIso(date, '19:00'),
      endIso: toDevBookingIso(date, '20:30'),
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
      startIso: toDevBookingIso(date, '18:30'),
      endIso: toDevBookingIso(date, '20:00'),
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
      checkedInAt: toDevBookingIso(date, '18:35'),
      checkedOutAt: null,
    },
  ];

  return buildSummaryFromBookings(date, bookings);
}

export function OpsDashboardDevHarness() {
  const factories = useMemo(() => createOpsDevServiceFactories(), []);
  const headerSwipeRef = useRef<HTMLElement>(null);
  const devServiceDate = useMemo(() => getDevServiceDate(), []);
  const initialNowIso = useMemo(
    () => toDevBookingIso(devServiceDate, DEV_NOW_TIME),
    [devServiceDate],
  );
  const [filter, setFilter] = useState<BookingFilter>('all');
  const [sortKey, setSortKey] = useState<'time' | 'party' | 'name'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState(() => buildSummary(devServiceDate));

  const tabCounts = useMemo(() => {
    return getBookingTabCounts({
      summary,
      allowTableAssignments: true,
      hasAssignmentHandlers: true,
    });
  }, [summary]);

  const guestStats = useMemo(
    () => ({ upcoming: tabCounts.upcoming, seated: tabCounts.seated }),
    [tabCounts],
  );
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
      onSearchChange: (event: ChangeEvent<HTMLInputElement>) =>
        setSearch(event.currentTarget.value),
      onPrint: () => toast.message('Dev harness: print not implemented'),
      onSortKeyChange: setSortKey,
      onSortDirChange: setSortDir,
    }),
    [filter, search, sortDir, sortKey, tabCounts],
  );
  const updateBooking = useCallback(
    (bookingId: string, updater: (booking: OpsTodayBooking) => OpsTodayBooking) => {
      setSummary((current) => {
        let didUpdate = false;
        const bookings = current.bookings.map((booking) => {
          if (booking.id !== bookingId) return booking;
          didUpdate = true;
          return updater(booking);
        });

        return didUpdate ? buildSummaryFromBookings(current.date, bookings) : current;
      });
    },
    [],
  );
  const bookingActions = useMemo<DashboardBookingActionHandlers>(
    () => ({
      onMarkNoShow: async (bookingId: string) => {
        updateBooking(bookingId, (booking) => ({
          ...booking,
          status: 'no_show',
        }));
        toast.success(`Marked no-show: ${bookingId}`);
      },
      onUndoNoShow: async (bookingId: string) => {
        updateBooking(bookingId, (booking) => ({
          ...booking,
          status: 'confirmed',
        }));
        toast.success(`Undo no-show: ${bookingId}`);
      },
      onCheckIn: async (bookingId: string) => {
        updateBooking(bookingId, (booking) => ({
          ...booking,
          status: 'checked_in',
          checkedInAt: getCurrentDevIso(),
        }));
        toast.success(`Checked in: ${bookingId}`);
      },
      onCheckOut: async (bookingId: string) => {
        updateBooking(bookingId, (booking) => ({
          ...booking,
          status: 'completed',
          checkedOutAt: getCurrentDevIso(),
        }));
        toast.success(`Checked out: ${bookingId}`);
      },
    }),
    [updateBooking],
  );

  const noop = useCallback(() => {}, []);

  return (
    <OpsDevProviders factories={factories} initialRestaurantId={DEV_RESTAURANT_ID}>
      <div className="min-h-screen bg-background">
        <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
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
        </OpsPageShell>
      </div>
    </OpsDevProviders>
  );
}
