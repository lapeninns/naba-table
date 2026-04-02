'use client';

import { MailCheck, MailWarning } from 'lucide-react';
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

function StatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge variant={tone.variant} className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}>
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function GroupHeader({ group, timezone }: { group: EmailDeliveryGroup; timezone: string }) {
  const when = formatEmailDeliveryOccurredAt(group.currentOccurredAt, timezone);
  const subject = group.subject ?? group.templateType ?? group.emailType ?? 'Email';

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        <StatusBadge status={group.currentStatus} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 truncate" title={subject}>
          {subject}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {group.variantName ? (
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
              {group.variantName}
            </Badge>
          ) : null}
          <span className="truncate" title={group.recipientEmail}>
            {group.recipientEmail}
          </span>
          {when ? <span className="whitespace-nowrap">{when}</span> : null}
        </div>
      </div>
    </div>
  );
}

type EmailDeliveryPanelProps = {
  bookingId: string;
  timezone: string;
  limit?: number;
};

export function EmailDeliveryPanel({ bookingId, timezone, limit = 50 }: EmailDeliveryPanelProps) {
  const query = useOpsBookingEmailDeliveryLog(bookingId, { limit });
  const heavyPanelStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 400px',
  } as CSSProperties;
  const wrapCard = (content: ReactElement) => <div style={heavyPanelStyle}>{content}</div>;

  const groups = useMemo(() => {
    const events = query.events ?? [];
    return groupEmailDeliveryEvents(events);
  }, [query.events]);

  if (query.isLoading) {
    return wrapCard(
      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <MailCheck className="h-4 w-4 text-slate-400" aria-hidden />
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
      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <MailWarning className="h-4 w-4 text-amber-500" aria-hidden />
          </div>
          <Alert className="border-amber-200/70 bg-amber-50/60">
            <AlertTitle>Delivery tracking unavailable</AlertTitle>
            <AlertDescription>
              This environment is not currently recording or exposing delivery events. Email sending can still work normally.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>,
    );
  }

  if (query.apiError) {
    return wrapCard(
      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <MailWarning className="h-4 w-4 text-rose-500" aria-hidden />
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
      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <MailWarning className="h-4 w-4 text-rose-500" aria-hidden />
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
      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <MailCheck className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <div className="text-sm text-slate-600">
            No delivery events recorded for this booking yet.
          </div>
        </CardContent>
      </Card>,
    );
  }

  return wrapCard(
    <Card className="border-slate-200/60 bg-white">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email Delivery
          </div>
          <MailCheck className="h-4 w-4 text-slate-400" aria-hidden />
        </div>
        <Separator />
        <Accordion type="multiple" className="space-y-2">
          {groups.map((group) => {
            const key = `${group.messageId}__${group.recipientEmail.toLowerCase()}`;
            return (
              <AccordionItem key={key} value={key} className="border-none rounded-lg bg-slate-50/60">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <GroupHeader group={group} timezone={timezone} />
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {group.events.map((event) => {
                      const eventKey = `${event.id}`;
                      const when =
                        formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
                      return (
                        <div key={eventKey} className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={event.status} />
                            <span className="text-xs text-slate-600">
                              {when ?? 'Unknown time'}
                            </span>
                          </div>
                          {event.error ? (
                            <span className="text-xs text-rose-700 truncate max-w-[50%]" title={event.error}>
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
