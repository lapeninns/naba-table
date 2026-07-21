import { Grid3X3, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';

export function TableAssignmentLoadingState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-4 p-4">
        <Skeleton className="h-6 w-40 rounded" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-10 rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function TableAssignmentErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unable to load tables</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>{error instanceof Error ? error.message : 'Failed to load tables.'}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function TableAssignmentEmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
        <Grid3X3 className="size-8 text-muted-foreground" />
        <Text variant="caption">No tables available right now.</Text>
        <Text variant="caption">
          Try adjusting the booking time or split the party.
        </Text>
      </CardContent>
    </Card>
  );
}
