import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { BookingsFilterBar, type BookingFilter } from './BookingsFilterBar';
import { BookingsList } from './BookingsList';
import { HeatmapCalendar } from './HeatmapCalendar';
import { SummaryMetrics } from './SummaryMetrics';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingHeatmap, OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const NO_BOOKINGS_TITLE = 'Bookings unavailable';
const NO_BOOKINGS_BODY = 'We could not load today’s reservations. Refresh the page or try again shortly.';

type DashboardSummaryCardProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  heatmap?: OpsBookingHeatmap;
  heatmapLoading?: boolean;
  heatmapError?: Error | null;
  filter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
  searchQuery?: string;
  sortKey: 'time' | 'party' | 'name';
  sortDir: 'asc' | 'desc';
  onSortKeyChange: (value: 'time' | 'party' | 'name') => void;
  onSortDirChange: (value: 'asc' | 'desc') => void;
  isRefetching?: boolean;
  showFilterBar?: boolean;
  showHeatmap?: boolean;
  allowTableAssignments?: boolean;
  restaurantSlug?: string | null;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    bookingId: string | null;
    tableId?: string | null;
  } | null;
  onMarkNoShow: (bookingId: string, options?: { performedAt?: string | null; reason?: string | null }) => Promise<void>;
  onUndoNoShow: (bookingId: string, reason?: string | null) => Promise<void>;
  onCheckIn: (bookingId: string) => Promise<void>;
  onCheckOut: (bookingId: string) => Promise<void>;
  pendingLifecycleAction?: {
    bookingId: string | null;
    action: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show';
  } | null;
};

export function DashboardSummaryCard({
  summary,
  restaurantName,
  selectedDate,
  onSelectDate,
  heatmap,
  heatmapLoading,
  heatmapError,
  filter,
  onFilterChange,
  searchQuery,
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  isRefetching,
  showFilterBar = true,
  showHeatmap = true,
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
            <CardTitle className="text-xl font-semibold text-foreground">Today’s service snapshot</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Monitor reservations for {restaurantName}. Track arrivals, highlight no-shows, and stay ahead of service.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        <SummaryMetrics totals={summary.totals} />

        {showFilterBar ? <BookingsFilterBar value={filter} onChange={onFilterChange} /> : null}

        <BookingsList
          bookings={summary.bookings}
          filter={filter}
          searchQuery={searchQuery}
          summary={summary}
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

        {showHeatmap ? (
          <section className="rounded-2xl border border-border/60 bg-muted/10 p-4">
            {heatmapError ? (
              <Alert variant="destructive" className="border-border/60 bg-transparent text-destructive">
                <AlertTitle>Unable to load booking heatmap</AlertTitle>
                <AlertDescription>We could not load booking density for this period. Try again later.</AlertDescription>
              </Alert>
            ) : (
              <HeatmapCalendar
                summary={summary}
                heatmap={heatmap}
                selectedDate={selectedDate}
                onSelectDate={onSelectDate}
                isLoading={heatmapLoading}
              />
            )}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
