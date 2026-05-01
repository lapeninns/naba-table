'use client';

import { AlertCircle, MessageSquare, MessageSquareWarning } from 'lucide-react';
import { useMemo } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { CSSProperties, ReactElement } from 'react';

function StatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const tone = getSmsDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}
    >
      {SMS_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function GroupHeader({ group, timezone }: { group: SmsDeliveryGroup; timezone: string }) {
  const when = formatSmsDeliveryOccurredAt(group.currentOccurredAt, timezone);
  const label = formatSmsTypeLabel(group.smsType);

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        <StatusBadge status={group.currentStatus} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground" title={label}>
          {label}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="truncate" title={group.recipientPhone}>
            {group.recipientPhone}
          </span>
          {when ? <span className="whitespace-nowrap">{when}</span> : null}
        </div>
      </div>
    </div>
  );
}

type SmsDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  limit?: number;
};

export function SmsDeliveryPanel({ bookingId, timezone, limit = 50 }: SmsDeliveryPanelProps) {
  const query = useOpsBookingSmsDeliveryLog(bookingId, { limit });
  const heavyPanelStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 280px',
  } as CSSProperties;
  const wrapCard = (content: ReactElement) => <div style={heavyPanelStyle}>{content}</div>;

  const groups = useMemo(() => {
    const events = query.events ?? [];
    return groupSmsDeliveryEvents(events);
  }, [query.events]);

  if (query.isLoading) {
    return wrapCard(
      <Card className="border-border bg-background">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Delivery
            </div>
            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>,
    );
  }

  if (query.unavailable) {
    return wrapCard(
      <Card className="border-border bg-background">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Delivery
            </div>
            <MessageSquareWarning className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <Alert className="border-border bg-muted/40">
            <AlertTitle>Delivery tracking unavailable</AlertTitle>
            <AlertDescription>
              This environment is not currently recording or exposing SMS delivery events. SMS
              sending can still work normally.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>,
    );
  }

  if (query.apiError) {
    return wrapCard(
      <Card className="border-border bg-background">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Delivery
            </div>
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
          </div>
          <Alert variant="destructive">
            <AlertTitle>Unable to load delivery events</AlertTitle>
            <AlertDescription>{query.apiError.error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>,
    );
  }

  if (query.error) {
    return wrapCard(
      <Card className="border-border bg-background">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Delivery
            </div>
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
          </div>
          <Alert variant="destructive">
            <AlertTitle>Unexpected error</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>,
    );
  }

  if (groups.length === 0) {
    return wrapCard(
      <Card className="border-border bg-background">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              SMS Delivery
            </div>
            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="text-sm text-muted-foreground">
            No delivery events recorded for this booking yet.
          </div>
        </CardContent>
      </Card>,
    );
  }

  return wrapCard(
    <Card className="border-border bg-background">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            SMS Delivery
          </div>
          <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <Separator />
        <Accordion type="multiple" className="space-y-2">
          {groups.map((group) => {
            const key = `${group.messageSid}__${group.recipientPhone}`;
            return (
              <AccordionItem key={key} value={key} className="rounded-lg border-none bg-muted/40">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <GroupHeader group={group} timezone={timezone} />
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {group.events.map((event) => {
                      const when =
                        formatSmsDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
                      return (
                        <div key={event.id} className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={event.status} />
                            <span className="text-xs text-muted-foreground">
                              {when ?? 'Unknown time'}
                            </span>
                          </div>
                          {event.error ? (
                            <span
                              className="max-w-[50%] truncate text-xs text-destructive"
                              title={event.error}
                            >
                              {event.error}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
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
