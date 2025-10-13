import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { OpsBookingHeatmap, OpsTodayBookingsSummary } from '@/types/ops';
import { SummaryMetrics } from './SummaryMetrics';
import { BookingsFilterBar, type BookingFilter } from './BookingsFilterBar';
import { BookingsList } from './BookingsList';
import { HeatmapCalendar } from './HeatmapCalendar';

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
  onMarkStatus: (bookingId: string, status: 'completed' | 'no_show') => Promise<void>;
  pendingBookingId?: string | null;
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
  onMarkStatus,
  pendingBookingId,
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
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl font-semibold text-foreground">Today’s service snapshot</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Monitor reservations for {restaurantName}. Track arrivals, highlight no-shows, and stay ahead of service.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
