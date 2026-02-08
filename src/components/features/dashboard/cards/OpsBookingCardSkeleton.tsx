import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function OpsBookingCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 border-border/60 bg-card/40 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <div className="flex min-w-[100px] shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-1.5">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-2.5 w-14" />
        </div>

        <div className="block h-8 w-px bg-border/60 sm:hidden" />

        <div className="mt-1 flex items-center gap-2 sm:mt-2">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 sm:w-48" />
            <Skeleton className="h-3 w-24 sm:w-32" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="h-3 w-px bg-border/60" />
          <Skeleton className="h-3 w-24" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 pt-3 sm:mt-0 sm:flex-col sm:items-end sm:border-0 sm:gap-3 sm:pt-0">
        <Skeleton className="h-11 w-full rounded-md sm:h-10 sm:w-24" />

        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </Card>
  );
}
