import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading placeholder. Mirrors the final map-first layout: a short header row, three COMPACT
 * stat placeholders (not the audited ~220px cards), then the map — with the desktop aside
 * placeholder hidden below `lg` so a phone shows the map first, not an empty side column.
 *
 * Kept in its own module (presentational, only depends on `Skeleton`) so it can be unit-tested
 * without pulling in the floor-plan data/state hook graph.
 */
export function FloorPlanLoadingSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy aria-label="Loading floor plan">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-24 md:h-9" />
      </div>
      <div data-testid="floor-skeleton-stats" className="grid grid-cols-3 gap-2 sm:gap-4">
        <Skeleton data-testid="floor-skeleton-stat" className="h-16 sm:h-[88px]" />
        <Skeleton data-testid="floor-skeleton-stat" className="h-16 sm:h-[88px]" />
        <Skeleton data-testid="floor-skeleton-stat" className="h-16 sm:h-[88px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19.5rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-[58vh] min-h-[20rem] max-h-[28rem] lg:h-[calc(100vh-18rem)] lg:min-h-[28rem] lg:max-h-[34rem]" />
        <Skeleton data-testid="floor-skeleton-aside" className="hidden lg:block lg:h-[34rem]" />
      </div>
    </div>
  );
}
