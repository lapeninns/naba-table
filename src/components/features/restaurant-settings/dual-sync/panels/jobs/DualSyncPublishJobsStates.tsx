import { AlertCircle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function DualSyncPublishJobsLoadingState({ className }: { readonly className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function DualSyncPublishJobsErrorState({
  className,
  message,
  onRetry,
}: {
  readonly className?: string;
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle aria-hidden />
      <AlertTitle>Couldn&apos;t load publish jobs.</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{message}</span>
        <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function DualSyncPublishJobsEmptyState({ className }: { readonly className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      No publish jobs recorded for this restaurant yet.
    </div>
  );
}
