import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DualSyncShellStateViewProps {
  readonly className?: string;
}

export function DualSyncShellLoadingState({ className }: DualSyncShellStateViewProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Google Business Profile sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

export function DualSyncShellErrorState({
  className,
  error,
}: DualSyncShellStateViewProps & { readonly error: unknown }) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="size-4" />
      <AlertTitle>Couldn&apos;t load dual-sync state.</AlertTitle>
      <AlertDescription>
        {error instanceof Error ? error.message : 'Unknown error.'}
      </AlertDescription>
    </Alert>
  );
}

export function DualSyncShellEmptyState({ className }: DualSyncShellStateViewProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Google Business Profile sync</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        No syncable fields in scope yet.
      </CardContent>
    </Card>
  );
}
