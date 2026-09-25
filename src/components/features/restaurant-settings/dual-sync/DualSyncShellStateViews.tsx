import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HttpError } from '@/lib/http/errors';

import { GbpStepCard } from '../google-business-profile/components/GbpStepCard';

const REVIEW_TITLE = 'Review differences';

export function DualSyncShellLoadingState() {
  return (
    <GbpStepCard step={3} title={REVIEW_TITLE} description="Comparing Nabatable with Google…">
      <div role="status" aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">Loading the differences</span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </GbpStepCard>
  );
}

export function DualSyncShellErrorState({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry?: () => void;
}) {
  const code = error instanceof HttpError ? error.code : null;
  return (
    <GbpStepCard
      step={3}
      title={REVIEW_TITLE}
      description="The comparison with Google could not be loaded."
    >
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>Couldn&apos;t load the differences.</AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          <span>
            {error instanceof Error ? error.message : 'Unknown error.'} Your saved settings are
            unchanged.
          </span>
          {code ? <span className="font-mono text-xs">Reason code {code}</span> : null}
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={onRetry}
            >
              Try again
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    </GbpStepCard>
  );
}

export function DualSyncShellEmptyState() {
  return (
    <GbpStepCard
      step={3}
      title={REVIEW_TITLE}
      description="No Nabatable fields can be compared with Google yet."
    />
  );
}
