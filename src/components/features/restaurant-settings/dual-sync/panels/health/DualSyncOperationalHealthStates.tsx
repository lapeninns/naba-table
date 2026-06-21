import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function DualSyncOperationalHealthLoadingState({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-2 md:grid-cols-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export function DualSyncOperationalHealthErrorState({
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
      <AlertTriangle aria-hidden />
      <AlertTitle>Couldn&apos;t load operational health.</AlertTitle>
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

export function DualSyncOperationalHealthEmptyState({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      No operational metrics loaded for this restaurant yet.
    </div>
  );
}
