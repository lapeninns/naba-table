import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { BookingsFilterBar, type BookingFilter } from './BookingsFilterBar';
import { BookingsList } from './BookingsList';
import { ExportBookingsButton } from './ExportBookingsButton';
import { HeatmapCalendar } from './HeatmapCalendar';
import { SummaryMetrics } from './SummaryMetrics';

import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';

const NO_BOOKINGS_TITLE = 'Bookings unavailable';
const NO_BOOKINGS_BODY = 'We could not load today’s reservations. Refresh the page or try again shortly.';

type DashboardSummaryCardProps = {
  summary: OpsTodayBookingsSummary;
  restaurantName: string;
  restaurantId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  heatmap?: OpsBookingHeatmap;
  heatmapLoading?: boolean;
  heatmapError?: Error | null;
  filter: BookingFilter;
  onFilterChange: (filter: BookingFilter) => void;
  onMarkStatus: (bookingId: string, status: 'completed' | 'no_show') => Promise<void>;
  pendingBookingId?: string | null;
  exportDate: string;
};

export function DashboardSummaryCard({
  summary,
  restaurantName,
  restaurantId,
  selectedDate,
  onSelectDate,
  heatmap,
  heatmapLoading,
  heatmapError,
  filter,
  onFilterChange,
  onMarkStatus,
  pendingBookingId,
  exportDate,
}: DashboardSummaryCardProps) {
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
          <ExportBookingsButton restaurantId={restaurantId} restaurantName={restaurantName} date={exportDate} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        <SummaryMetrics totals={summary.totals} />

        <BookingsFilterBar value={filter} onChange={onFilterChange} />

        <BookingsList
          bookings={summary.bookings}
          filter={filter}
          summary={summary}
          onMarkStatus={onMarkStatus}
          pendingBookingId={pendingBookingId}
        />

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
      </CardContent>
    </Card>
  );
}
