'use client';

import { Lock } from 'lucide-react';
import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';
import { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';

import { GbpAlerts } from './GbpAlerts';
import { GbpLinkedLayout } from './GbpLinkedLayout';
import { GbpOperationsPanel } from './GbpOperationsPanel';
import { GbpOverviewCard } from './GbpOverviewCard';

import type { GoogleBusinessProfileSectionState } from '../useGoogleBusinessProfileSectionState';

const GbpSyncWorkspace = dynamic(
  () => import('./GbpSyncWorkspace').then((module) => module.GbpSyncWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-4" role="status" aria-busy="true">
        <span className="sr-only">Comparing Nabatable with Google…</span>
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    ),
  },
);

export type GbpLinkedViewProps = {
  readonly restaurantId: string;
  readonly section: GoogleBusinessProfileSectionState;
  /** Write state and its controls are for staff who can manage settings. */
  readonly canManageSettings: boolean;
};

/** The page once a listing is linked. The comparison workspace loads on its own. */
export function GbpLinkedView({ restaurantId, section, canManageSettings }: GbpLinkedViewProps) {
  const operator = useOpsGbpOperatorState(canManageSettings ? restaurantId : null);
  const { summary, data, linkedLocation } = section;
  if (!data || !linkedLocation) return null;

  if (summary.canReview) {
    return (
      <GbpSyncWorkspace
        restaurantId={restaurantId}
        section={section}
        operator={canManageSettings ? operator : null}
      />
    );
  }

  // Linked but not comparable right now (Google access expired, or comparison unavailable).
  const operatorState =
    operator.connectionQuery.data ?? operator.setWriteAccessMutation.data ?? null;
  const operatorUnavailable = canManageSettings && Boolean(operator.connectionQuery.error);
  const needsReconnect = summary.status === 'reauth_required';

  return (
    <GbpLinkedLayout
      overview={
        <GbpOverviewCard
          data={data}
          location={linkedLocation}
          accountLabel={summary.accountLabel}
          operator={canManageSettings ? operatorState : null}
          operatorUnavailable={operatorUnavailable}
          checkedAt={data.lastPullAt}
          manageHref={summary.manageOnGoogleHref}
          refresh={{
            label: section.connectionQuery.isFetching ? 'Checking…' : 'Check again',
            onClick: section.refreshHandler,
            pending: section.connectionQuery.isFetching,
            disabled: false,
          }}
        />
      }
      alerts={
        <GbpAlerts
          operator={canManageSettings ? operatorState : null}
          operatorUnavailable={operatorUnavailable}
          onRetryOperator={() => void operator.connectionQuery.refetch()}
          reauth={{
            needed: needsReconnect,
            account: summary.accountLabel,
            onReconnect: {
              label: section.startAuthorizationMutation.isPending
                ? 'Reconnecting…'
                : 'Reconnect Google',
              onClick: section.handleConnectGoogle,
              pending: section.startAuthorizationMutation.isPending,
            },
          }}
          syncError={null}
          refresh={{
            label: 'Check again',
            onClick: section.refreshHandler,
            pending: section.connectionQuery.isFetching,
          }}
          paused={null}
          lastPublish={null}
        />
      }
      differenceCount={null}
      review={
        <p className="flex items-center gap-2 rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden />
          {needsReconnect
            ? 'Reconnect Google to compare your details with the listing again.'
            : 'Comparison tools are unavailable right now. Check the listing on Google directly.'}
        </p>
      }
      operations={
        <GbpOperationsPanel
          operator={canManageSettings ? operator : null}
          sync={null}
          diagnostics={null}
          onRequestDisconnect={summary.canDisconnect ? section.handleRequestDisconnect : null}
          isDisconnecting={section.disconnectMutation.isPending}
        />
      }
      operationsNeedAttention={false}
    />
  );
}
