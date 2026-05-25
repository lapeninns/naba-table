'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { OpsEmailDeliveryAnalyticsContent } from './OpsEmailDeliveryAnalyticsContent';
import { OpsEmailDeliveryAnalyticsHeader } from './OpsEmailDeliveryAnalyticsHeader';
import {
  OpsEmailDeliveryAnalyticsErrorState,
  OpsEmailDeliveryAnalyticsLoadingState,
  OpsEmailDeliveryAnalyticsUnavailableState,
} from './OpsEmailDeliveryAnalyticsStates';
import { buildOpsEmailDeliveryAnalyticsModel } from '../opsEmailDeliveryAnalyticsDomain';

import type { OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';

export type OpsEmailDeliveryAnalyticsProps = {
  summary: OpsEmailDeliverySummary | null;
  isLoading: boolean;
  isUpdating: boolean;
  range: OpsEmailDeliveryRange;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  errorMessage?: string | null;
  lastUpdatedAt?: number | null;
};

export function OpsEmailDeliveryAnalytics({
  summary,
  isLoading,
  isUpdating,
  range,
  onRangeChange,
  errorMessage,
  lastUpdatedAt,
}: OpsEmailDeliveryAnalyticsProps) {
  const analyticsModel = summary ? buildOpsEmailDeliveryAnalyticsModel(summary) : null;

  return (
    <section aria-label="Email delivery analytics" className="space-y-6">
      <Card className={OPS_CARD_CLASS}>
        <OpsEmailDeliveryAnalyticsHeader
          isLoading={isLoading}
          isUpdating={isUpdating}
          lastUpdatedAt={lastUpdatedAt}
          onRangeChange={onRangeChange}
          range={range}
        />

        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-6 pt-4')}>
          {errorMessage ? <OpsEmailDeliveryAnalyticsErrorState message={errorMessage} /> : null}
          {isLoading && !summary ? (
            <OpsEmailDeliveryAnalyticsLoadingState />
          ) : summary ? (
            <OpsEmailDeliveryAnalyticsContent model={analyticsModel!} />
          ) : !errorMessage ? (
            <OpsEmailDeliveryAnalyticsUnavailableState />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
