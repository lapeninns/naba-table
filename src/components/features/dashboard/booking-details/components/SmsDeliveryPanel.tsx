'use client';

import { MessageSquare, MessageSquareWarning } from 'lucide-react';
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
import { Text } from '@/components/ui/typography';
import { useOpsBookingSmsDeliveryLog } from '@/hooks/ops/useOpsBookingSmsDeliveryLog';
import { cn } from '@/lib/utils';
import { groupSmsDeliveryEvents } from '@/src/lib/sms-delivery/grouping';
import {
  formatSmsDeliveryOccurredAt,
  formatSmsTypeLabel,
  getSmsDeliveryStatusBadgeTone,
  SMS_DELIVERY_STATUS_LABELS,
} from '@/src/lib/sms-delivery/presentation';

import type { SmsDeliveryGroup } from '@/src/lib/sms-delivery/grouping';
import type { SmsDeliveryStatus } from '@/types/smsDelivery';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

export type SmsDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  limit?: number;
  enabled?: boolean;
  /** When true, omit the outer card chrome (parent provides a shared shell). */
  embedded?: boolean;
};

function StatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const tone = getSmsDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn(
        'h-5 rounded px-1.5 text-[9px] font-bold uppercase tracking-wider',
        tone.className,
      )}
    >
      {SMS_DELIVERY_STATUS_LABELS[status] ?? status}
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
    return (
      <Text variant="caption" className="leading-relaxed text-muted-foreground/80">
        {description}
      </Text>
    );
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
            Messages
          </div>
          {icon}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ChannelBadge({
  channel,
  fallbackForAttemptId,
}: {
  channel?: SmsDeliveryGroup['channel'];
  fallbackForAttemptId?: string | null;
}) {
  return (
    <Badge
      variant="outline"
      className="h-5 shrink-0 rounded px-1.5 text-[9px] font-bold uppercase tracking-wider"
    >
      {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
      {fallbackForAttemptId ? ' fallback' : ''}
    </Badge>
  );
}

function GroupHeader({ group, timezone }: { group: SmsDeliveryGroup; timezone: string }) {
  const when = formatSmsDeliveryOccurredAt(group.currentOccurredAt, timezone);
  const label = formatSmsTypeLabel(group.smsType);

  return (
    <div className="flex w-full items-center justify-between gap-3 overflow-hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <StatusBadge status={group.currentStatus} />
        <ChannelBadge
          channel={group.channel}
          fallbackForAttemptId={group.fallbackForAttemptId}
        />
        <div
          className="truncate text-[11px] font-bold tracking-tight text-foreground"
          title={label}
        >
          {label}
        </div>
      </div>
      <div className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        {when}
      </div>
    </div>
  );
}

export function SmsDeliveryPanel({
  bookingId,
  timezone,
  limit = 20,
  enabled = true,
  embedded = false,
}: SmsDeliveryPanelProps) {
  const query = useOpsBookingSmsDeliveryLog(bookingId, { limit, enabled });
  const heavyPanelStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 120px',
  } as CSSProperties;
  const wrapCard = (content: ReactElement) => <div style={heavyPanelStyle}>{content}</div>;

  const groups = useMemo(() => {
    const events = query.events ?? [];
    return groupSmsDeliveryEvents(events);
  }, [query.events]);

  if (query.isLoading) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MessageSquareWarning className="size-3 text-muted-foreground/50" aria-hidden />}
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
        icon={<MessageSquareWarning className="size-3 text-muted-foreground/50" aria-hidden />}
      >
        <DeliveryStateBody
          title="Tracking unavailable"
          description="This environment is not currently recording or exposing message delivery events. Sending can still work normally."
        />
      </PanelShell>,
    );
  }

  if (query.apiError) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MessageSquareWarning className="size-3 text-destructive" aria-hidden />}
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
        icon={<MessageSquareWarning className="size-3 text-destructive" aria-hidden />}
      >
        <DeliveryStateBody
          title="Unexpected delivery error"
          description={query.error.message}
          tone="danger"
        />
      </PanelShell>,
    );
  }

  if (groups.length === 0) {
    return wrapCard(
      <PanelShell
        embedded={embedded}
        icon={<MessageSquareWarning className="size-3 text-muted-foreground/50" aria-hidden />}
      >
        <DeliveryStateBody
          title="No message events"
          description={
            embedded
              ? 'No message events recorded yet.'
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
      icon={<MessageSquare className="size-3 text-muted-foreground/50" aria-hidden />}
    >
      <Accordion type="multiple" className="flex w-full flex-col gap-1.5">
        {groups.map((group) => {
          const key = `${group.messageSid}__${group.recipientPhone}`;
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
                    Recipient: {group.recipientPhone}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {group.events.map((event) => {
                      const when =
                        formatSmsDeliveryOccurredAt(event.occurredAt, timezone) ??
                        event.occurredAt;
                      return (
                        <div key={event.id} className="flex items-center justify-between gap-3">
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
