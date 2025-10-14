import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type DashboardErrorStateProps = {
  onRetry?: () => void;
};

export function DashboardErrorState({ onRetry }: DashboardErrorStateProps) {
  return (
    <Alert variant="destructive" className="border-border/60 bg-destructive/10 text-destructive">
      <AlertTitle>We couldn’t load the dashboard</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-sm sm:gap-4">
        <span>Check your connection and try again. If the issue persists, contact support.</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="h-11 w-fit touch-manipulation">
            Retry
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
