'use client';

import { Badge } from '@/components/ui/badge';

import { OpsEmailDeliveryStuckSummaryAlert } from './OpsEmailDeliveryStuckSummaryAlert';
import { OpsEmailDeliverySummaryDetails } from './OpsEmailDeliverySummaryDetails';
import { OpsEmailDeliverySummaryDistribution } from './OpsEmailDeliverySummaryDistribution';
import { OpsEmailDeliverySummaryMetricCards } from './OpsEmailDeliverySummaryMetricCards';
import {
  OpsEmailDeliverySummaryLoadingState,
  OpsEmailDeliverySummaryUnavailableState,
} from './OpsEmailDeliverySummaryStates';
import { buildOpsEmailSummaryMetricsModel } from '../opsEmailDeliverySummaryMetricsDomain';

import type { EmailDeliveryStatus, OpsEmailDeliverySummary } from '@/types/emailDelivery';

export type OpsEmailDeliverySummaryMetricsProps = {
  summary: OpsEmailDeliverySummary | null;
  isLoading: boolean;
  isUpdating: boolean;
  onFilterStatus?: (status: EmailDeliveryStatus | null) => void;
};

export function OpsEmailDeliverySummaryMetrics({
  summary,
  isLoading,
  isUpdating,
  onFilterStatus,
}: OpsEmailDeliverySummaryMetricsProps) {
  if (isLoading && !summary) {
    return <OpsEmailDeliverySummaryLoadingState />;
  }

  if (!summary) {
    return <OpsEmailDeliverySummaryUnavailableState />;
  }

  const metricsModel = buildOpsEmailSummaryMetricsModel(summary);

  return (
    <section aria-label="Email delivery metrics" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">Deliverability</div>
        {isUpdating ? (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Updating…
          </Badge>
        ) : null}
      </div>

      <OpsEmailDeliveryStuckSummaryAlert stuckInFlight={metricsModel.stuckInFlight} />
      <OpsEmailDeliverySummaryMetricCards
        metrics={metricsModel.primaryMetrics}
        onFilterStatus={onFilterStatus}
      />
      <OpsEmailDeliverySummaryDistribution
        distributionSegments={metricsModel.distributionSegments}
        distributionSummary={metricsModel.distributionSummary}
      />
      <OpsEmailDeliverySummaryDetails
        failureLists={metricsModel.failureLists}
        secondaryMetrics={metricsModel.secondaryMetrics}
      />
    </section>
  );
}
