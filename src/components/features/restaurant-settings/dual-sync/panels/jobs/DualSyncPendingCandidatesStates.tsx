import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface DualSyncPendingCandidatesLoadingStateProps {
  readonly className?: string;
}

export function DualSyncPendingCandidatesLoadingState({
  className,
}: DualSyncPendingCandidatesLoadingStateProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export interface DualSyncPendingCandidatesErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly className?: string;
}

export function DualSyncPendingCandidatesErrorState({
  message,
  onRetry,
  className,
}: DualSyncPendingCandidatesErrorStateProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="size-4" />
      <AlertTitle>Couldn&apos;t load pending changes.</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{message}</span>
        <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export interface DualSyncPendingCandidatesEmptyStateProps {
  readonly className?: string;
}

export function DualSyncPendingCandidatesEmptyState({
  className,
}: DualSyncPendingCandidatesEmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      No pending Core changes are waiting for Google export.
    </div>
  );
}
