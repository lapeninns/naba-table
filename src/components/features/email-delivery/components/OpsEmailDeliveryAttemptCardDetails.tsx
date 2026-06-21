'use client';

import { CopyButton } from '@/components/ui/copy-button';

import { OpsEmailDeliveryStatusBadge } from './OpsEmailDeliveryStatusBadge';

import type { OpsEmailDeliveryAttemptCardModel } from '../opsEmailDeliveryAttemptCardDomain';

type OpsEmailDeliveryAttemptCardDetailsProps = {
  model: OpsEmailDeliveryAttemptCardModel;
};

export function OpsEmailDeliveryAttemptCardDetails({
  model,
}: OpsEmailDeliveryAttemptCardDetailsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Message id
          </div>
          <div
            className="max-w-full break-all font-mono text-xs text-muted-foreground"
            title={model.messageId}
          >
            {model.messageId}
          </div>
        </div>
        <CopyButton text={model.messageId} label="message id" variant="outline" size="sm" />
      </div>

      <div className="flex flex-col gap-2">
        {model.eventRows.map((event) => (
          <div key={event.id} className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <OpsEmailDeliveryStatusBadge status={event.status} />
              <span className="text-xs text-muted-foreground">{event.occurredAtLabel}</span>
            </div>
            {event.error ? (
              <span
                className="min-w-0 max-w-[55%] truncate text-xs text-destructive"
                title={event.error}
              >
                {event.error}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
