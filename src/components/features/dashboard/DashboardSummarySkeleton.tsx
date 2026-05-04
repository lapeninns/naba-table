import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type DashboardSummarySkeletonProps = {
  restaurantName?: string;
};

export function DashboardSummarySkeleton({ restaurantName }: DashboardSummarySkeletonProps) {
  const resolvedName = restaurantName?.trim() || 'your restaurant';
  const bookingKeys = ['booking-skeleton-1', 'booking-skeleton-2', 'booking-skeleton-3', 'booking-skeleton-4'];
  return (
    <Card className="border-border/60" aria-busy="true">
      <CardHeader className="p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold text-foreground">Bookings</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Active reservations for {resolvedName}. Search, filter, and take action without
              leaving this view.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
        {/* Mock OpsDashboardToolbar */}
        <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <div className="-mx-2 overflow-x-auto px-2 scrollbar-hide md:mx-0 md:px-0">
                <div className="flex flex-wrap gap-2 py-2 sm:gap-3">
                  <Skeleton className="h-9 w-16 rounded-full" />
                  <Skeleton className="h-9 w-24 rounded-full" />
                  <Skeleton className="h-9 w-20 rounded-full" />
                  <Skeleton className="h-9 w-28 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex gap-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
              <Skeleton className="h-9 w-full md:w-64 rounded" />
            </div>
          </div>
        </div>

        {/* Mock Bookings List */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Skeleton className="hidden h-5 w-8 sm:block" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Skeleton className="h-9 w-full rounded sm:w-[150px]" />
              <Skeleton className="h-9 w-full rounded sm:w-[130px]" />
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {bookingKeys.map((key) => (
              <OpsBookingCardSkeleton key={key} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
