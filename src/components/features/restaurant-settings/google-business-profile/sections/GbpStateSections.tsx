import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type GbpErrorSectionProps = {
  error: Error;
  onRetry: () => void;
};

export function NoRestaurantGbpSection() {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Select a restaurant using the sidebar switcher to manage its Google Business Profile
        connection.
      </CardContent>
    </Card>
  );
}

export function LoadingGbpSection() {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="flex flex-col gap-3 p-5" aria-busy="true" role="status">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </CardContent>
    </Card>
  );
}

export function ErrorGbpSection({ error, onRetry }: GbpErrorSectionProps) {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="py-6">
        <Alert variant="destructive">
          <AlertTitle>Unable to load Google Business Profile</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function EmptyGbpConnectionSection() {
  return (
    <Card variant="compact" className="border-border/70 shadow-none">
      <CardContent className="py-6 text-sm text-muted-foreground">
        Google Business Profile connection details are not available for this restaurant yet.
        Refresh to retry.
      </CardContent>
    </Card>
  );
}
