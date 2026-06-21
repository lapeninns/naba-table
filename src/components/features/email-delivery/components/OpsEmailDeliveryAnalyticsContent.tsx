import { OpsEmailDeliveryAnalyticsDistribution } from './OpsEmailDeliveryAnalyticsDistribution';
import { OpsEmailDeliveryAnalyticsFailureSection } from './OpsEmailDeliveryAnalyticsFailureSection';
import { OpsEmailDeliveryAnalyticsSecondaryMetrics } from './OpsEmailDeliveryAnalyticsSecondaryMetrics';
import { OpsEmailDeliveryAnalyticsTiles } from './OpsEmailDeliveryAnalyticsTiles';

import type { OpsEmailDeliveryAnalyticsModel } from '../opsEmailDeliveryAnalyticsDomain';

export function OpsEmailDeliveryAnalyticsContent({
  model,
}: {
  model: OpsEmailDeliveryAnalyticsModel;
}) {
  return (
    <>
      <OpsEmailDeliveryAnalyticsTiles tiles={model.primaryTiles} />
      <OpsEmailDeliveryAnalyticsDistribution
        segments={model.distributionSegments}
        total={model.total}
      />
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <OpsEmailDeliveryAnalyticsSecondaryMetrics metrics={model.secondaryMetrics} />
        {model.failureSections.map((section) => (
          <OpsEmailDeliveryAnalyticsFailureSection key={section.key} section={section} />
        ))}
      </div>
    </>
  );
}
