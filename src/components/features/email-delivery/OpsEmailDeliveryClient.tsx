'use client';

import { OpsEmailDeliveryAnalytics } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalytics';
import {
  OpsEmailDeliveryAutoRefreshControls,
  OpsEmailDeliveryHeader,
  OpsEmailDeliveryNoAccessState,
} from '@/components/features/email-delivery/components/OpsEmailDeliveryClientChrome';
import { OpsEmailDeliveryLogTab } from '@/components/features/email-delivery/components/OpsEmailDeliveryLogTab';
import { OpsEmailQueuePanel } from '@/components/features/email-delivery/components/OpsEmailQueuePanel';
import { useOpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { OpsEmailDeliveryClientProps } from '@/components/features/email-delivery/useOpsEmailDeliveryState';

export type { OpsEmailDeliveryClientProps } from '@/components/features/email-delivery/useOpsEmailDeliveryState';
export type { EmailDeliveryTab } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

export function OpsEmailDeliveryClient(props: OpsEmailDeliveryClientProps) {
  const state = useOpsEmailDeliveryState(props);

  if (state.memberships.length === 0) {
    return <OpsEmailDeliveryNoAccessState />;
  }

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsEmailDeliveryHeader state={state} />

      <Tabs
        value={state.queryState.tab}
        onValueChange={state.queryState.handleTabChange}
        className="mt-6"
      >
        <OpsEmailDeliveryAutoRefreshControls state={state} />

        <TabsList>
          <TabsTrigger value="delivery-log">Delivery Log</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery-log">
          <OpsEmailDeliveryLogTab state={state} />
        </TabsContent>

        <TabsContent value="queue">
          <OpsEmailQueuePanel
            restaurantId={state.effectiveRestaurantId}
            timezone={state.timezone}
            enabled={state.queryState.tab === 'queue'}
            refetchIntervalMs={
              state.queryState.tab === 'queue' ? state.dataState.refreshIntervalMs : false
            }
            refreshKey={state.queryState.tab === 'queue' ? state.manualRefreshNonce : 0}
            fixture={state.queryState.queueFixture}
            onRefreshStateChange={state.setQueueRefreshState}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <OpsEmailDeliveryAnalytics
            summary={state.dataState.analyticsSummary}
            isLoading={state.dataState.analyticsQuery.isLoading}
            isUpdating={
              state.dataState.analyticsQuery.isFetching && !state.dataState.analyticsQuery.isLoading
            }
            range={state.queryState.range}
            onRangeChange={state.queryState.applyRange}
            errorMessage={state.analyticsErrorMessage}
            lastUpdatedAt={
              state.dataState.analyticsQuery.dataUpdatedAt > 0
                ? state.dataState.analyticsQuery.dataUpdatedAt
                : null
            }
          />
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
