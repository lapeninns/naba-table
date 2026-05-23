import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DualSyncPublishJobDetailMissingState() {
  return <div className="p-3 text-xs text-muted-foreground">Detail loader not configured.</div>;
}

export function DualSyncPublishJobDetailLoadingState() {
  return (
    <div className="flex flex-col gap-2 p-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

export interface DualSyncPublishJobDetailErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
}

export function DualSyncPublishJobDetailErrorState({
  message,
  onRetry,
}: DualSyncPublishJobDetailErrorStateProps) {
  return (
    <div className="flex items-start gap-2 p-3 text-xs text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <div>Couldn&apos;t load job detail.</div>
        <div className="opacity-80">{message}</div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export function DualSyncPublishJobDetailStaleState() {
  return <div className="p-3 text-xs text-muted-foreground">Loading detail…</div>;
}

export function DualSyncPublishJobDetailEmptyState() {
  return (
    <div className="p-3 text-xs text-muted-foreground">No operations recorded for this job.</div>
  );
}
