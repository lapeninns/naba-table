'use client';

import { Clock } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SMS_DELIVERY_STALE_THRESHOLD_HOURS } from '@/types/smsDelivery';

export type OpsSmsDeliveryStaleAlertProps = {
  stuckInFlight: number;
  stuckOnly?: boolean;
  onToggleStuckOnly?: () => void;
};

export function OpsSmsDeliveryStaleAlert({
  stuckInFlight,
  stuckOnly = false,
  onToggleStuckOnly,
}: OpsSmsDeliveryStaleAlertProps) {
  if (stuckInFlight <= 0 && !stuckOnly) return null;

  return (
    <Alert variant="warning">
      <Clock className="size-4" aria-hidden />
      <AlertTitle className="text-sm font-semibold">
        {stuckInFlight} messages still awaiting terminal status
      </AlertTitle>
      <AlertDescription className="max-w-[75ch] text-sm">
        These SMS/WhatsApp attempts are still at <code className="font-mono">queued</code> or{' '}
        <code className="font-mono">sent</code> more than {SMS_DELIVERY_STALE_THRESHOLD_HOURS}h
        after Twilio accepted them. Twilio recommends polling the Message resource when a message
        has not reached <code className="font-mono">delivered</code> or{' '}
        <code className="font-mono">undelivered</code> within that window because a status callback
        may have been missed. Likely causes: a missed callback, carrier delay, or a message that
        never progressed beyond queueing/sending. Any row below flagged &ldquo;Stuck&rdquo; warrants
        Twilio log review or reconciliation.
        {onToggleStuckOnly ? (
          <div className="mt-3">
            <Button variant="outline" aria-pressed={stuckOnly} onClick={onToggleStuckOnly}>
              {stuckOnly ? 'Show all messages' : 'Show stuck only'}
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export default OpsSmsDeliveryStaleAlert;
