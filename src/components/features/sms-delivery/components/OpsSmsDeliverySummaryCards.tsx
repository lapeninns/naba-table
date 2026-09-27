'use client';

import { CommunicationsDeliveryMetricGrid } from '@/components/features/communications-delivery/components/CommunicationsDeliveryMetricGrid';

import { getSmsDeliveryFailureCount, getSmsDeliveryRatePercent } from '../opsSmsDeliveryDomain';

import type { CommunicationsDeliveryOverviewMetric } from '@/components/features/communications-delivery/communicationsDeliveryTypes';
import type { OpsSmsDeliverySummary } from '@/types/smsDelivery';

export type OpsSmsDeliverySummaryCardsProps = {
  isLoading: boolean;
  summary: OpsSmsDeliverySummary | null;
};

/**
 * Same four-card pattern as the Overview. Every summary count stays visible: unique recipients
 * sits under total attempts, stuck-in-flight under failures, fallbacks under the channel split.
 */
export function buildSmsDeliverySummaryMetrics(
  summary: OpsSmsDeliverySummary | null,
): CommunicationsDeliveryOverviewMetric[] {
  const total = summary?.total ?? 0;
  return [
    {
      label: 'Delivered rate',
      value: `${summary && total ? getSmsDeliveryRatePercent(summary.delivered / total) : 0}%`,
      hint: `${summary?.delivered ?? 0}/${total} attempts`,
    },
    {
      label: 'Total attempts',
      value: String(total),
      hint: `${summary?.uniqueRecipients ?? 0} unique recipients`,
    },
    {
      label: 'Failures',
      value: String(summary ? getSmsDeliveryFailureCount(summary) : 0),
      hint: `${summary?.stuckInFlight ?? 0} stuck in flight`,
    },
    {
      label: 'WhatsApp / SMS',
      value: `${summary?.whatsappCount ?? 0} / ${summary?.smsCount ?? 0}`,
      hint: `${summary?.fallbackCount ?? 0} fallbacks`,
    },
  ];
}

export function OpsSmsDeliverySummaryCards({
  isLoading,
  summary,
}: OpsSmsDeliverySummaryCardsProps) {
  return (
    <CommunicationsDeliveryMetricGrid
      label="Message delivery summary"
      isLoading={isLoading}
      metrics={buildSmsDeliverySummaryMetrics(summary)}
    />
  );
}

export default OpsSmsDeliverySummaryCards;
