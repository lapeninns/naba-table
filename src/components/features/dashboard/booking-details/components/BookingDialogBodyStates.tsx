import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type BookingDialogErrorStateProps = {
  errorMessage: string;
  onRetry?: () => void;
};

export function BookingDialogLoadingState() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function BookingDialogErrorState({ errorMessage, onRetry }: BookingDialogErrorStateProps) {
  return (
    <div className="p-4">
      <Alert variant="destructive">
        <AlertTitle>Unable to load booking</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function BookingDialogEmptyState() {
  return (
    <div className="p-4">
      <Alert>
        <AlertTitle>No booking selected</AlertTitle>
        <AlertDescription>Select a booking to view details.</AlertDescription>
      </Alert>
    </div>
  );
}
