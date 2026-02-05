import { OpsBookingCardSkeleton } from '@/components/features/dashboard/cards/OpsBookingCardSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  const skeletonKeys = [
    'booking-skeleton-1',
    'booking-skeleton-2',
    'booking-skeleton-3',
    'booking-skeleton-4',
  ];
  return (
    <div className="min-h-screen bg-background" aria-busy="true">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Header Skeleton matching OpsDashboardClient layout */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 sm:h-9 sm:w-48" />
            <Skeleton className="h-4 w-56 sm:h-5 sm:w-72" />
          </div>
          {/* Date Navigator Skeleton */}
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Toolbar Skeleton */}
        <div className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Tabs Skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-16 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-16 rounded-md" />
              <Skeleton className="h-9 w-18 rounded-md" />
            </div>
            {/* Search Skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-full md:w-64 rounded-lg" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Booking Cards Skeleton */}
        <div className="space-y-4">
          {skeletonKeys.map((key) => (
            <OpsBookingCardSkeleton key={key} />
          ))}
        </div>
      </main>
    </div>
  );
}
