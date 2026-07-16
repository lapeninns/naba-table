'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SMS_DELIVERY_STALE_THRESHOLD_HOURS } from '@/types/smsDelivery';

export type OpsSmsDeliveryStaleAlertProps = {
  stuckInFlight: number;
};

export function OpsSmsDeliveryStaleAlert({ stuckInFlight }: OpsSmsDeliveryStaleAlertProps) {
  if (stuckInFlight <= 0) return null;

  return (
    <Alert className="mt-4 border-border bg-muted/40 text-foreground">
      <AlertTitle className="text-sm font-semibold">
        {stuckInFlight} messages still awaiting terminal status
      </AlertTitle>
      <AlertDescription className="text-xs">
        These SMS/WhatsApp attempts are still at <code>queued</code> or <code>sent</code> more than{' '}
        {SMS_DELIVERY_STALE_THRESHOLD_HOURS}h after Twilio accepted them. Twilio recommends polling
        the Message resource when a message has not reached <code>delivered</code> or{' '}
        <code>undelivered</code> within that window because a status callback may have been missed.
        Likely causes: a missed callback, carrier delay, or a message that never progressed beyond
        queueing/sending. Any row below flagged &ldquo;Stuck&rdquo; warrants Twilio log review or
        reconciliation.
      </AlertDescription>
    </Alert>
  );
}

export default OpsSmsDeliveryStaleAlert;
