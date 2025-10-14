import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48 sm:h-7 sm:w-64" />
        <Skeleton className="h-4 w-56 sm:w-80" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>

      <Skeleton className="h-12 w-full max-w-xs" />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>

      <Skeleton className="h-48 w-full" />
    </div>
  );
}
