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
import { toUserMessage } from '@/lib/http/userMessage';
import { cn } from '@/lib/utils';
import { groupEmailDeliveryEvents } from '@/src/lib/email-delivery/grouping';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@/src/lib/email-delivery/presentation';

import type { EmailDeliveryGroup } from '@/src/lib/email-delivery/grouping';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type EmailDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  limit?: number;
  enabled?: boolean;
  /** When true, omit the outer card chrome (parent provides a shared shell). */
  embedded?: boolean;
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

function DeliveryStateBody({
  title,
  description,
  tone = 'neutral',
  quiet = false,
}: {
  title: string;
  description: string;
  tone?: 'neutral' | 'danger';
  /** Flat empty copy for the shared delivery shell (no nested box). */
  quiet?: boolean;
}) {
  if (quiet) {
    return <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>;
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        tone === 'danger'
          ? 'border-destructive/20 bg-destructive/5 text-destructive'
          : 'border-border/40 bg-muted/20 text-muted-foreground',
      )}
    >
      <div className="text-[10px] font-bold uppercase tracking-widest">{title}</div>
      <div className="mt-1 text-xs leading-relaxed">{description}</div>
    </div>
  );
}

function PanelShell({
  embedded,
  icon,
  children,
}: {
  embedded: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  if (embedded) {
    return <div className="flex flex-col gap-3">{children}</div>;
  }

  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Email
          </div>
          {icon}
        </div>
        {children}
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
      <div className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
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
  embedded = false,
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
      <PanelShell
        embedded={embedded}
        icon={<MailWarning className="size-3 text-muted-foreground/50" aria-hidden />}
      >
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </PanelShell>,
    );
  }

  if (query.unavailable) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MailWarning className="size-3 text-muted-foreground/50" aria-hidden />}
      >
        <DeliveryStateBody
          title="Tracking unavailable"
          description="This environment is not currently recording or exposing delivery events. Email sending can still work normally."
        />
      </PanelShell>,
    );
  }

  if (query.apiError) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MailWarning className="size-3 text-destructive" aria-hidden />}
      >
        <DeliveryStateBody
          title="Unable to load events"
          description={query.apiError.error}
          tone="danger"
        />
      </PanelShell>,
    );
  }

  if (query.error) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MailWarning className="size-3 text-destructive" aria-hidden />}
      >
        <DeliveryStateBody
          title="Unexpected delivery error"
          description={toUserMessage(query.error, {
            fallback: "Couldn't load email delivery. Try again.",
          })}
          tone="danger"
        />
      </PanelShell>,
    );
  }

  if (groups.length === 0) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MailWarning className="size-3 text-muted-foreground/50" aria-hidden />}
      >
        <DeliveryStateBody
          title="No email events"
          description={
            embedded
              ? 'No email events recorded yet.'
              : 'No delivery events have been recorded for this booking yet.'
          }
          quiet={embedded}
        />
      </PanelShell>,
    );
  }

  return wrapCard(
    <PanelShell
      embedded={embedded}
      icon={<MailCheck className="size-3 text-muted-foreground/50" aria-hidden />}
    >
      <Accordion type="multiple" className="flex w-full flex-col gap-1.5">
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
                <div className="flex flex-col gap-2 border-t border-border/40 pt-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    Recipient: {group.recipientEmail}
                  </div>
                  <div className="flex flex-col gap-1.5">
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
                              className="truncate text-[10px] font-bold uppercase tracking-tighter text-destructive/80"
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
    </PanelShell>,
  );
}
