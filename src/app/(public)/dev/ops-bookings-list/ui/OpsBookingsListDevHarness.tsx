'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { BookingsTable } from '@/components/dashboard/BookingsTable';
import {
  BookingOfflineBanner,
  type BookingAction,
} from '@/components/features/booking-state-machine';
import { OpsBookingsSearchInput } from '@/components/features/bookings/components/OpsBookingsSearchInput';
import { buildOpsBookingsCardRows } from '@/components/features/bookings/opsBookingsSelectors';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookingStateMachineProvider } from '@/contexts/booking-state-machine';
import useOnlineStatus from '@/hooks/useOnlineStatus';

import type { BookingDTO } from '@/hooks/useBookings';
import type { StatusFilter } from '@/hooks/useBookingsTableState';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function createDevBookings(): BookingDTO[] {
  // Use "today" in UTC so Ops booking meta helpers (isToday/isPastDay) behave predictably.
  const now = new Date();
  now.setUTCHours(19, 0, 0, 0);
  const iso = (d: Date) => d.toISOString();

  const base: BookingDTO[] = [
    {
      id: 'dev-bk-1',
      restaurantId: 'rest-dev',
      restaurantName: 'Dev Restaurant',
      restaurantSlug: 'dev-restaurant',
      restaurantTimezone: 'UTC',
      partySize: 4,
      startIso: iso(now),
      endIso: iso(new Date(now.getTime() + 90 * 60 * 1000)),
      status: 'confirmed',
      notes: 'Window seat if possible.',
      customerName: 'Alex Johnson',
      customerEmail: 'alex@example.com',
      customerPhone: '+447700900123',
      reservationIntervalMinutes: 15,
      reference: 'DEV123',
      source: 'phone',
      seatingPreference: null,
      allergies: ['Nuts'],
      dietaryRestrictions: ['Vegetarian'],
      tableAssignments: [],
      requiresTableAssignment: true,
      checkedInAt: null,
      checkedOutAt: null,
    },
    {
      id: 'dev-bk-2',
      restaurantId: 'rest-dev',
      restaurantName: 'Dev Restaurant',
      restaurantSlug: 'dev-restaurant',
      restaurantTimezone: 'UTC',
      partySize: 2,
      startIso: iso(new Date(now.getTime() - 30 * 60 * 1000)),
      endIso: iso(new Date(now.getTime() + 60 * 60 * 1000)),
      status: 'checked_in',
      notes: null,
      customerName: 'Sam Patel',
      customerEmail: null,
      customerPhone: '+447700900999',
      reservationIntervalMinutes: 15,
      reference: 'DEV456',
      source: 'walk_in',
      seatingPreference: null,
      allergies: null,
      dietaryRestrictions: null,
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
      checkedInAt: iso(new Date(now.getTime() - 20 * 60 * 1000)),
      checkedOutAt: null,
    },
    {
      id: 'dev-bk-3',
      restaurantId: 'rest-dev',
      restaurantName: 'Dev Restaurant',
      restaurantSlug: 'dev-restaurant',
      restaurantTimezone: 'UTC',
      partySize: 3,
      startIso: iso(new Date(now.getTime() - 3 * 60 * 60 * 1000)),
      endIso: iso(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      status: 'confirmed',
      notes: 'Birthday, bring candle.',
      customerName: 'Taylor',
      customerEmail: 'taylor@example.com',
      customerPhone: null,
      reservationIntervalMinutes: 15,
      reference: 'DEV789',
      source: 'online',
      seatingPreference: null,
      allergies: null,
      dietaryRestrictions: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
    },
  ];

  // Add enough rows to make the page scrollable for sticky toolbar/banner verification.
  const extra: BookingDTO[] = Array.from({ length: 32 }, (_, index) => {
    const offsetMinutes = (index + 1) * 10;
    const start = new Date(now.getTime() + offsetMinutes * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      id: `dev-bk-extra-${index + 1}`,
      restaurantId: 'rest-dev',
      restaurantName: 'Dev Restaurant',
      restaurantSlug: 'dev-restaurant',
      restaurantTimezone: 'UTC',
      partySize: (index % 6) + 1,
      startIso: iso(start),
      endIso: iso(end),
      status: index % 5 === 0 ? 'pending' : 'confirmed',
      notes: index % 7 === 0 ? 'Dietary note example.' : null,
      customerName: `Guest ${index + 1}`,
      customerEmail: null,
      customerPhone: null,
      reservationIntervalMinutes: 15,
      reference: `DEVX${String(index + 1).padStart(3, '0')}`,
      source: 'online',
      seatingPreference: null,
      allergies: null,
      dietaryRestrictions: null,
      tableAssignments: [],
      requiresTableAssignment: false,
      checkedInAt: null,
      checkedOutAt: null,
    };
  });

  return [...base, ...extra];
}

export function OpsBookingsListDevHarness() {
  const isOnline = useOnlineStatus();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingActionsByBookingId, setPendingActionsByBookingId] = useState<
    Record<string, BookingAction | null>
  >({});

  const bookings = useMemo(() => createDevBookings(), []);

  const setPending = useCallback((bookingId: string, action: BookingAction | null) => {
    setPendingActionsByBookingId((current) => ({ ...current, [bookingId]: action }));
  }, []);

  const getLabel = useCallback(
    (bookingId: string) =>
      bookings.find((b) => b.id === bookingId)?.customerName?.trim() || 'Walk-in Guest',
    [bookings],
  );

  const runAction = useCallback(
    async (bookingId: string, action: BookingAction, onSuccess: () => void) => {
      const guestLabel = getLabel(bookingId);

      if (!isOnline) {
        toast.message(`Queued ${action}: ${guestLabel}`, {
          description: 'This will sync automatically once you reconnect.',
        });
        return;
      }

      setPending(bookingId, action);
      try {
        await sleep(800);
        onSuccess();
      } finally {
        setPending(bookingId, null);
      }
    },
    [getLabel, isOnline, setPending],
  );

  const handleCheckIn = useCallback(
    async (bookingId: string) =>
      runAction(bookingId, 'check-in', () => toast.success(`Seated: ${getLabel(bookingId)}`)),
    [getLabel, runAction],
  );

  const handleCheckOut = useCallback(
    async (bookingId: string) =>
      runAction(bookingId, 'check-out', () => toast.success(`Finished: ${getLabel(bookingId)}`)),
    [getLabel, runAction],
  );

  const handleUndoNoShow = useCallback(
    async (bookingId: string) =>
      runAction(bookingId, 'undo-no-show', () =>
        toast.success(`Undo no-show: ${getLabel(bookingId)}`),
      ),
    [getLabel, runAction],
  );

  const handleMarkNoShow = useCallback(
    async (bookingId: string) =>
      runAction(bookingId, 'no-show', () => {
        toast.success(`Marked no-show: ${getLabel(bookingId)}`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              void handleUndoNoShow(bookingId);
            },
          },
        });
      }),
    [getLabel, handleUndoNoShow, runAction],
  );

  const filteredBookings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((b) => (b.customerName ?? '').toLowerCase().includes(q));
  }, [bookings, searchTerm]);
  const rows = useMemo(
    () =>
      buildOpsBookingsCardRows({
        bookings: filteredBookings,
        timezone: 'UTC',
        now: new Date(),
        pendingActionsByBookingId,
      }),
    [filteredBookings, pendingActionsByBookingId],
  );

  return (
    <BookingStateMachineProvider initialBookings={[]}>
      <div className="min-h-screen bg-background font-sans text-foreground">
        <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
          <Button
            asChild
            variant="link"
            className="sr-only h-auto p-0 focus:not-sr-only focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <a href="#ops-bookings-list">Skip to bookings list</a>
          </Button>
          <OpsPageHeader
            title="Manage bookings (dev harness)"
            meta={
              <Badge variant="secondary" className="rounded-md font-medium">
                Dev Restaurant
              </Badge>
            }
          />

          <OpsPageToolbar
            sticky
            search={
              <OpsBookingsSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={() => setSearchTerm('')}
                isSearching={false}
                ariaLabel="Search bookings"
                placeholder="Search bookings..."
                size="toolbar"
              />
            }
          >
            <BookingOfflineBanner />
          </OpsPageToolbar>

          <BookingsTable
            variant="ops"
            rows={rows}
            total={rows.length}
            statusFilter={statusFilter}
            isLoading={false}
            isFetching={false}
            error={null}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onStatusFilterChange={(next) => setStatusFilter(next)}
            onLoadMore={() => {}}
            onRetry={() => {}}
            onEdit={() => {}}
            onCancel={() => toast.message('Cancel is not wired in the dev harness.')}
            onDetails={() => toast.message('Details is not wired in the dev harness.')}
            hideHeader
            showHeaderTitle={false}
            timezone="UTC"
            opsLifecycle={{
              onCheckIn: handleCheckIn,
              onCheckOut: handleCheckOut,
              onMarkNoShow: handleMarkNoShow,
              onUndoNoShow: handleUndoNoShow,
            }}
          />
        </OpsPageShell>
      </div>
    </BookingStateMachineProvider>
  );
}
