'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function OpsEmailQueueLoadingTable() {
  return (
    <div
      aria-label="Loading email queue"
      className="overflow-hidden rounded-xl border border-border bg-background"
    >
      <div className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-border px-4 py-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-20" />
        ))}
      </div>
      <div className="space-y-0">
        {Array.from({ length: 4 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[1.1fr_1.7fr_1.4fr_1.2fr_1.1fr] gap-3 border-b border-border px-4 py-4 last:border-b-0"
          >
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OpsEmailQueueLoadingTable;
