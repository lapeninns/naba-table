'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function OpsEmailDeliverySummaryLoadingState() {
  return (
    <section aria-label="Email delivery metrics">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Deliverability</div>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Loading...
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-[92px] w-full" />
        <Skeleton className="h-[92px] w-full" />
        <Skeleton className="h-[92px] w-full" />
        <Skeleton className="h-[92px] w-full" />
      </div>
    </section>
  );
}

export function OpsEmailDeliverySummaryUnavailableState() {
  return (
    <Alert className="border-border bg-muted/40">
      <AlertTitle>Metrics unavailable</AlertTitle>
      <AlertDescription>
        Deliverability metrics couldn&apos;t be calculated. The attempt list is still available.
      </AlertDescription>
    </Alert>
  );
}
