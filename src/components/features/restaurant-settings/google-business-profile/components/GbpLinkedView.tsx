'use client';

import { Lock } from 'lucide-react';
import dynamic from 'next/dynamic';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsGbpOperatorState } from '@/hooks/ops/useOpsGoogleBusinessProfile';

import { GbpAlerts } from './GbpAlerts';
import { GbpLinkedLayout } from './GbpLinkedLayout';
import { GbpLiveConnectionPanel } from './GbpLiveConnectionPanel';
import { GbpOperationsPanel, type GbpOperatorQueries } from './GbpOperationsPanel';
import { GbpOverviewCard } from './GbpOverviewCard';
import { getGbpReconnectReason } from '../gbpPageModel';

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

  const content = summary.canReview ? (
    <GbpSyncWorkspace
      restaurantId={restaurantId}
      section={section}
      operator={canManageSettings ? operator : null}
    />
  ) : (
    <GbpUnavailableView
      section={section}
      canManageSettings={canManageSettings}
      operator={operator}
    />
  );
  const state = operator.connectionQuery.data ?? operator.setWriteAccessMutation.data;
  if (!canManageSettings) return content;
  return (
    <GbpLiveConnectionPanel
      restaurantId={restaurantId}
      connectionKey={[
        data.externalAccountId,
        data.externalLocationId,
        data.status,
        state?.connectionGeneration,
        state?.consentEpoch,
        state?.connectionStatus,
        state?.writeState,
      ].join(':')}
      connectionLoading={operator.connectionQuery.isLoading}
      savedStatus={data.status}
      onCheckFailed={section.refreshHandler}
      operations={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={section.handleConnectGoogle}
            disabled={section.startAuthorizationMutation.isPending}
          >
            Reconnect Google
          </Button>
          <GbpOperationsPanel
            operator={operator}
            sync={null}
            diagnostics={null}
            onRequestDisconnect={summary.canDisconnect ? section.handleRequestDisconnect : null}
            isDisconnecting={section.disconnectMutation.isPending}
          />
        </>
      }
    >
      {content}
    </GbpLiveConnectionPanel>
  );
}

function GbpUnavailableView({
  section,
  canManageSettings,
  operator,
}: Omit<GbpLinkedViewProps, 'restaurantId'> & { readonly operator: GbpOperatorQueries }) {
  const { summary, data, linkedLocation } = section;
  if (!data || !linkedLocation) return null;

  // Linked but not comparable right now (Google access expired, or comparison unavailable).
  const operatorState =
    operator.connectionQuery.data ?? operator.setWriteAccessMutation.data ?? null;
  const operatorUnavailable = canManageSettings && Boolean(operator.connectionQuery.error);
  const reconnectReason = getGbpReconnectReason({
    connectionStatus: summary.status,
    operator: canManageSettings ? operatorState : null,
  });
  const needsReconnect = reconnectReason !== null;

  return (
    <GbpLinkedLayout
      overview={
        <GbpOverviewCard
          data={data}
          location={linkedLocation}
          accountLabel={summary.accountLabel}
          operator={canManageSettings ? operatorState : null}
          operatorUnavailable={operatorUnavailable}
          reconnectReason={reconnectReason}
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
            reason: reconnectReason,
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
        <OpsEmptyState
          size="compact"
          icon={<Lock className="size-5" aria-hidden />}
          title="Comparison unavailable"
          description={
            needsReconnect
              ? 'Reconnect Google to compare your details with the listing again.'
              : 'Comparison tools are unavailable right now. Check the listing on Google directly.'
          }
        />
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
