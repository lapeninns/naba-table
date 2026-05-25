'use client';

import { OPS_CARD_CONTENT_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { OpsEmailQueueJobsTable } from './OpsEmailQueueJobsTable';
import { OpsEmailQueueLoadingTable } from './OpsEmailQueueLoadingTable';

import type { OpsEmailQueuePanelState } from '../useOpsEmailQueuePanelState';

export type OpsEmailQueuePanelContentProps = {
  restaurantId: string | null;
  state: OpsEmailQueuePanelState;
  timezone: string;
};

export function OpsEmailQueuePanelContent({
  restaurantId,
  state,
  timezone,
}: OpsEmailQueuePanelContentProps) {
  return (
    <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'flex flex-col gap-4 pt-4')}>
      {state.showRefetchIndicator ? <OpsEmailQueueRefreshingNotice /> : null}
      {state.query.apiError ? (
        <OpsEmailQueueErrorNotice message={state.query.apiError.error} />
      ) : state.query.error ? (
        <OpsEmailQueueErrorNotice message={state.query.error.message} />
      ) : (state.showLoadingState || state.shouldForceFixtureLoadingMarker) &&
        state.jobs.length === 0 ? (
        <OpsEmailQueueLoadingTable />
      ) : state.jobs.length === 0 ? (
        <OpsEmptyState
          title="No queued emails right now"
          description="No booking emails are currently queued for this restaurant. Scheduled reminders and confirmations will appear here as soon as jobs are waiting to send."
          className="min-h-[180px] bg-muted/40"
        />
      ) : (
        <OpsEmailQueueJobsTable
          hasNext={Boolean(state.query.response?.ok && state.query.response.pageInfo.hasNext)}
          jobs={state.jobs}
          onNextPage={state.handleNextPage}
          onPreviousPage={state.handlePreviousPage}
          page={state.page}
          restaurantId={restaurantId}
          timezone={timezone}
          total={state.total}
        />
      )}
    </CardContent>
  );
}

function OpsEmailQueueRefreshingNotice() {
  return (
    <div
      role="region"
      aria-label="Refreshing email queue"
      aria-busy="true"
      className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-foreground"
    >
      <Skeleton className="size-2.5 rounded-full" />
      <span className="font-medium">Refreshing queued jobs...</span>
    </div>
  );
}

function OpsEmailQueueErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  );
}
