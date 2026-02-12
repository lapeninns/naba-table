import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardSummarySkeletonProps = {
  restaurantName?: string;
};

export function DashboardSummarySkeleton({ restaurantName }: DashboardSummarySkeletonProps) {
  const resolvedName = restaurantName?.trim() || 'your restaurant';
  const metricKeys = ['metric-1', 'metric-2', 'metric-3', 'metric-4'];
  const bookingKeys = ['booking-skeleton-1', 'booking-skeleton-2', 'booking-skeleton-3'];
  return (
    <Card className="border-border/60" aria-busy="true">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold text-foreground">
            Today’s service snapshot
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Monitor reservations for {resolvedName}. Track arrivals, highlight no-shows, and stay
            ahead of service.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {metricKeys.map((key) => (
            <Skeleton key={key} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {bookingKeys.map((key) => (
            <OpsBookingCardSkeleton key={key} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
