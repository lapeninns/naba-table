import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardSummarySkeletonProps = {
  restaurantName?: string;
};

export function DashboardSummarySkeleton({ restaurantName }: DashboardSummarySkeletonProps) {
  const resolvedName = restaurantName?.trim() || 'your restaurant';
  return (
    <Card className="border-border/60">
      <CardHeader className="p-4 md:p-6">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold text-foreground">Today’s service snapshot</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Monitor reservations for {resolvedName}. Track arrivals, highlight no-shows, and stay ahead of service.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`metric-${index}`} className="h-16 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <OpsBookingCardSkeleton key={`booking-skeleton-${index}`} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
