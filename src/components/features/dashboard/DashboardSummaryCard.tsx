import dynamic from 'next/dynamic';

import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { OpsDashboardToolbar } from './OpsDashboardToolbar';

import type {
  DashboardBookingActionHandlers,
  DashboardListControls,
} from './types';
import type { OpsTodayBookingsSummary } from '@/types/ops';

const NO_BOOKINGS_TITLE = 'Bookings unavailable';
const NO_BOOKINGS_BODY =
  'We could not load today’s reservations. Refresh the page or try again shortly.';

type DashboardSummaryCardProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  controls: DashboardListControls;
  bookingActions: DashboardBookingActionHandlers;
  initialNowIso: string;
  allowTableAssignments?: boolean;
  restaurantSlug?: string | null;
};

const BookingsList = dynamic(() => import('./BookingsList').then((mod) => mod.BookingsList), {
  loading: () => <BookingsListSkeleton />,
});

export function DashboardSummaryCard({
  summary,
  restaurantName,
  controls,
  bookingActions,
  initialNowIso,
  allowTableAssignments,
  restaurantSlug,
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
          filter={controls.filter}
          tabCounts={controls.tabCounts}
          searchQuery={controls.searchQuery ?? ''}
          onFilterChange={controls.onFilterChange}
          onSearchChange={controls.onSearchChange}
          onPrint={controls.onPrint}
          sticky={false}
        />

        <BookingsList
          bookings={summary.bookings}
          controls={{
            filter: controls.filter,
            searchQuery: controls.deferredSearchQuery ?? controls.searchQuery,
            sortKey: controls.sortKey,
            sortDir: controls.sortDir,
            onSortKeyChange: controls.onSortKeyChange,
            onSortDirChange: controls.onSortDirChange,
            isRefetching: controls.isRefetching,
          }}
          bookingActions={bookingActions}
          summary={summary}
          initialNowIso={initialNowIso}
          allowTableAssignments={canAssignTables}
          restaurantSlug={restaurantSlug}
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
