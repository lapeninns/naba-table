import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { formatEmailDeliveryOccurredAt } from '@src/lib/email-delivery/presentation';

import { OpsEmailDeliveryStatusBadge } from './OpsEmailDeliveryStatusBadge';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

export function OpsEmailDeliveryTableDetail({
  attempt,
  timezone,
  restaurantId,
}: {
  attempt: OpsEmailDeliveryAttemptDTO;
  timezone: string;
  restaurantId: string;
}) {
  const errorEvent = attempt.events.find((event) => event.error);

  return (
    <div className="flex flex-col gap-4 px-2 py-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Message ID
          </div>
          <div
            className="max-w-full break-all font-mono text-xs text-muted-foreground"
            title={attempt.messageId}
          >
            {attempt.messageId}
          </div>
        </div>
        <CopyMessageIdButton text={attempt.messageId} />
      </div>

      {attempt.bookingId ? (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/app/bookings?restaurantId=${restaurantId}&focus=${attempt.bookingId}`}
              prefetch={false}
              onClick={(event) => event.stopPropagation()}
            >
              Open booking
            </Link>
          </Button>
        </div>
      ) : null}

      {errorEvent?.error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <div className="text-[11px] font-semibold tracking-wide text-destructive uppercase">
            Error
          </div>
          <div className="text-xs text-destructive">{errorEvent.error}</div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Event Timeline
        </div>
        <div className="flex flex-col gap-1.5">
          {attempt.events.map((event) => {
            const eventWhen =
              formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
            return (
              <div key={event.id} className="flex items-center gap-2 text-xs">
                <OpsEmailDeliveryStatusBadge status={event.status} />
                <span className="text-muted-foreground">{eventWhen}</span>
                {event.error ? (
                  <span className="truncate text-destructive" title={event.error}>
                    {event.error}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CopyMessageIdButton({ text }: { text: string }) {
  const handleCopy = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const target = event.currentTarget;
      try {
        await navigator.clipboard.writeText(text);
        target.setAttribute('aria-label', 'Message ID copied');
      } catch {
        target.setAttribute('aria-label', 'Copy message id');
      }
    },
    [text],
  );

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copy message id">
      <Copy data-icon="inline-start" aria-hidden />
      <Check className="sr-only" aria-hidden />
      <span className="sr-only">Copy message id</span>
    </Button>
  );
}
