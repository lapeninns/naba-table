import dynamic from 'next/dynamic';

import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { OpsDashboardToolbar } from './OpsDashboardToolbar';

import type { BookingFilter, BookingTabCounts } from './BookingsFilterBar';
import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';
import type { ChangeEvent } from 'react';

const NO_BOOKINGS_TITLE = 'Bookings unavailable';
const NO_BOOKINGS_BODY =
  'We could not load today’s reservations. Refresh the page or try again shortly.';

type DashboardSummaryCardProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  filter: BookingFilter;
  tabCounts: BookingTabCounts;
  initialNowIso: string;
  onFilterChange: (filter: BookingFilter) => void;
  searchQuery?: string;
  deferredSearchQuery?: string;
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPrint: () => void;
  sortKey: 'time' | 'party' | 'name';
  sortDir: 'asc' | 'desc';
  onSortKeyChange: (value: 'time' | 'party' | 'name') => void;
  onSortDirChange: (value: 'asc' | 'desc') => void;
  isRefetching?: boolean;
  allowTableAssignments?: boolean;
  restaurantSlug?: string | null;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onAssignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (
    bookingId: string,
    tableId: string,
  ) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
  onMarkNoShow: (
    bookingId: string,
    options?: { performedAt?: string | null; reason?: string | null },
  ) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
    snapshot?: Pick<OpsTodayBooking, 'status' | 'startTime' | 'endTime'> | null;
  } | null;
};

const BookingsList = dynamic(() => import('./BookingsList').then((mod) => mod.BookingsList), {
  loading: () => <BookingsListSkeleton />,
});

export function DashboardSummaryCard({
  summary,
  restaurantName,
  filter,
  tabCounts,
  initialNowIso,
  onFilterChange,
  searchQuery,
  deferredSearchQuery,
  onSearchChange,
  onPrint,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  isRefetching,
  allowTableAssignments,
  restaurantSlug,
  onDetails,
  onEdit,
  onCancel,
  onAssignTable,
  onUnassignTable,
  tableActionState,
  onMarkNoShow,
  onUndoNoShow,
  onCheckIn,
  onCheckOut,
  pendingLifecycleAction,
}: DashboardSummaryCardProps) {
  const canAssignTables =
    typeof allowTableAssignments === 'boolean'
      ? allowTableAssignments
      : summary.date >= getTodayInTimezone(summary.timezone);

  if (!summary) {
    return (
      <Alert variant="destructive" className="border-border/60 bg-destructive/10 text-destructive">
        <AlertTitle>{NO_BOOKINGS_TITLE}</AlertTitle>
        <AlertDescription>{NO_BOOKINGS_BODY}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold text-foreground">Bookings</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Active reservations for {restaurantName}. Search, filter, and take action without
              leaving this view.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        <OpsDashboardToolbar
          filter={filter}
          tabCounts={tabCounts}
          searchQuery={searchQuery ?? ''}
          onFilterChange={onFilterChange}
          onSearchChange={onSearchChange}
          onPrint={onPrint}
          sticky={false}
        />

        <BookingsList
          bookings={summary.bookings}
          filter={filter}
          searchQuery={deferredSearchQuery ?? searchQuery}
          summary={summary}
          initialNowIso={initialNowIso}
          allowTableAssignments={canAssignTables}
          restaurantSlug={restaurantSlug}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKeyChange={onSortKeyChange}
          onSortDirChange={onSortDirChange}
          isRefetching={isRefetching}
          onDetails={onDetails}
          onEdit={onEdit}
          onCancel={onCancel}
          onMarkNoShow={onMarkNoShow}
          onUndoNoShow={onUndoNoShow}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          pendingLifecycleAction={pendingLifecycleAction}
          onAssignTable={onAssignTable}
          onUnassignTable={onUnassignTable}
          tableActionState={tableActionState}
        />
      </CardContent>
    </Card>
  );
}

function BookingsListSkeleton() {
  const bookingKeys = ['booking-skeleton-1', 'booking-skeleton-2', 'booking-skeleton-3'];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="space-y-4">
        {bookingKeys.map((key) => (
          <OpsBookingCardSkeleton key={key} />
        ))}
      </div>
    </div>
  );
}
