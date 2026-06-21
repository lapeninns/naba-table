'use client';

import { MailCheck, MailWarning } from 'lucide-react';
import { useMemo } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpsBookingEmailDeliveryLog } from '@/hooks/ops/useOpsBookingEmailDeliveryLog';
import { cn } from '@/lib/utils';
import { groupEmailDeliveryEvents } from '@/src/lib/email-delivery/grouping';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@/src/lib/email-delivery/presentation';

import type { EmailDeliveryGroup } from '@/src/lib/email-delivery/grouping';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';
import type { CSSProperties, ReactElement } from 'react';

export type EmailDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  limit?: number;
  enabled?: boolean;
};

function StatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn(
        'h-5 rounded px-1.5 text-[9px] font-bold uppercase tracking-wider',
        tone.className,
      )}
    >
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function DeliveryStateCard({
  title,
  description,
  tone = 'neutral',
}: {
  title: string;
  description: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Email Observability
          </div>
          <MailWarning
            className={cn(
              'size-3',
              tone === 'danger' ? 'text-destructive' : 'text-muted-foreground/50',
            )}
            aria-hidden
          />
        </div>
        <div
          className={cn(
            'rounded border p-2.5',
            tone === 'danger'
              ? 'border-destructive/20 bg-destructive/5 text-destructive'
              : 'border-border/40 bg-muted/20 text-muted-foreground',
          )}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest">{title}</div>
          <div className="mt-1 text-xs leading-relaxed">{description}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupHeader({ group, timezone }: { group: EmailDeliveryGroup; timezone: string }) {
  const when = formatEmailDeliveryOccurredAt(group.currentOccurredAt, timezone);
  const subject = group.subject ?? group.templateType ?? group.emailType ?? 'Email';

  return (
    <div className="flex w-full items-center justify-between gap-3 overflow-hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <StatusBadge status={group.currentStatus} />
        <div
          className="truncate text-[11px] font-bold tracking-tight text-foreground"
          title={subject}
        >
          {subject}
        </div>
      </div>
      <div className="shrink-0 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
        {when}
      </div>
    </div>
  );
}

export function EmailDeliveryPanel({
  bookingId,
  timezone,
  limit = 20,
  enabled = true,
}: EmailDeliveryPanelProps) {
  const query = useOpsBookingEmailDeliveryLog(bookingId, { limit, enabled });
  const heavyPanelStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 120px',
  } as CSSProperties;
  const wrapCard = (content: ReactElement) => <div style={heavyPanelStyle}>{content}</div>;

  const groups = useMemo(() => {
    const events = query.events ?? [];
    return groupEmailDeliveryEvents(events);
  }, [query.events]);

  if (query.isLoading) {
    return wrapCard(
      <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
        <CardContent className="space-y-3 p-3">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (query.unavailable) {
    return wrapCard(
      <DeliveryStateCard
        title="Tracking unavailable"
        description="This environment is not currently recording or exposing delivery events. Email sending can still work normally."
      />,
    );
  }

  if (query.apiError) {
    return wrapCard(
      <DeliveryStateCard
        title="Unable to load events"
        description={query.apiError.error}
        tone="danger"
      />,
    );
  }

  if (query.error) {
    return wrapCard(
      <DeliveryStateCard
        title="Unexpected delivery error"
        description={query.error.message}
        tone="danger"
      />,
    );
  }

  if (groups.length === 0) {
    return wrapCard(
      <DeliveryStateCard
        title="No email events"
        description="No delivery events have been recorded for this booking yet."
      />,
    );
  }

  return wrapCard(
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Email Observability
          </div>
          <MailCheck className="size-3 text-muted-foreground/50" aria-hidden />
        </div>

        <Accordion type="multiple" className="w-full space-y-1.5">
          {groups.map((group) => {
            const key = `${group.messageId}__${group.recipientEmail.toLowerCase()}`;
            return (
              <AccordionItem
                key={key}
                value={key}
                className="rounded border border-border/40 bg-muted/5"
              >
                <AccordionTrigger className="px-2.5 py-2 hover:no-underline">
                  <GroupHeader group={group} timezone={timezone} />
                </AccordionTrigger>
                <AccordionContent className="px-2.5 pb-2.5">
                  <div className="space-y-2 border-t border-border/40 pt-2">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                      Recipient: {group.recipientEmail}
                    </div>
                    <div className="space-y-1.5">
                      {group.events.map((event) => {
                        const eventKey = `${event.id}`;
                        const when =
                          formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ??
                          event.occurredAt;
                        return (
                          <div key={eventKey} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={event.status} />
                              <span className="text-[10px] font-medium text-muted-foreground/60">
                                {when}
                              </span>
                            </div>
                            {event.error && (
                              <span
                                className="truncate text-[10px] font-bold text-destructive/80 uppercase tracking-tighter"
                                title={event.error}
                              >
                                {event.error}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>,
  );
}
