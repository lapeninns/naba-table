'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import type { OpsEmailSummaryMetricsModel } from '../opsEmailDeliverySummaryMetricsDomain';

type OpsEmailDeliveryStuckSummaryAlertProps = {
  stuckInFlight: OpsEmailSummaryMetricsModel['stuckInFlight'];
};

export function OpsEmailDeliveryStuckSummaryAlert({
  stuckInFlight,
}: OpsEmailDeliveryStuckSummaryAlertProps) {
  if (!stuckInFlight) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-primary/30 bg-primary/10 text-primary">
      <AlertTitle className="text-sm font-semibold">
        {stuckInFlight.count} email{stuckInFlight.count === 1 ? '' : 's'} stuck without a delivery
        receipt
      </AlertTitle>
      <AlertDescription className="text-xs">
        These were accepted by the provider more than {stuckInFlight.thresholdHours}h ago but never
        received a terminal webhook (<code>delivered</code> / <code>bounced</code> /{' '}
        <code>failed</code>). Likely causes: dropped webhook, provider incident, or the recipient
        mailbox silently discarded it. Open any row below flagged &ldquo;Stuck&rdquo; to investigate
        or retry.
      </AlertDescription>
    </Alert>
  );
}
