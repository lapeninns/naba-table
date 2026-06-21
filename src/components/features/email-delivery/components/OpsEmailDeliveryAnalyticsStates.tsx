import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export function OpsEmailDeliveryAnalyticsLoadingState() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </>
  );
}

export function OpsEmailDeliveryAnalyticsUnavailableState() {
  return (
    <Alert className="border-border bg-muted/40">
      <AlertTitle>Analytics unavailable</AlertTitle>
      <AlertDescription>
        Summary metrics could not be calculated for this range right now.
      </AlertDescription>
    </Alert>
  );
}

export function OpsEmailDeliveryAnalyticsErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load analytics</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
