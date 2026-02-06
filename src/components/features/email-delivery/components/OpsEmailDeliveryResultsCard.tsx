'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { useMemo } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@src/lib/email-delivery/presentation';

import type { EmailDeliveryStatus, OpsEmailDeliveryBookingDTO } from '@/types/emailDelivery';
import type { EmailDeliveryGroup } from '@src/lib/email-delivery/grouping';

function formatBookingStart(booking: OpsEmailDeliveryBookingDTO, timezone: string): string | null {
  const iso = `${booking.bookingDate}T${booking.startTime}`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return null;
  return dt.toFormat('EEE, MMM d · HH:mm');
}

function groupBookingId(group: EmailDeliveryGroup): string | null {
  for (const event of group.events) {
    if (event.bookingId) return event.bookingId;
  }
  return null;
}

function StatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone = getEmailDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}
    >
      {EMAIL_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function GroupHeader({
  group,
  timezone,
  booking,
  restaurantId,
}: {
  group: EmailDeliveryGroup;
  timezone: string;
  booking: OpsEmailDeliveryBookingDTO | null;
  restaurantId: string;
}) {
  const when = formatEmailDeliveryOccurredAt(group.currentOccurredAt, timezone);
  const subject = group.subject ?? group.templateType ?? group.emailType ?? 'Email';
  const bookingStart = booking ? formatBookingStart(booking, timezone) : null;
  const bookingId = groupBookingId(group);

  return (
    <div className="flex min-w-0 w-full items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5">
          <StatusBadge status={group.currentStatus} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate" title={subject}>
            {subject}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="max-w-full break-all sm:truncate" title={group.recipientEmail}>
              {group.recipientEmail}
            </span>
            {when ? <span className="whitespace-nowrap">{when}</span> : null}
            {booking ? (
              <span
                className="max-w-full break-words sm:truncate"
                title={`${booking.reference} · ${booking.customerName}`}
              >
                {booking.reference} · {booking.customerName}
              </span>
            ) : null}
            {bookingStart ? <span className="whitespace-nowrap">{bookingStart}</span> : null}
          </div>
        </div>
      </div>

      {bookingId ? (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
        >
          <Link href={`/app/bookings?restaurantId=${restaurantId}&focus=${bookingId}`} prefetch={false}>
            Open booking
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export type OpsEmailDeliveryResultsCardProps = {
  groups: EmailDeliveryGroup[];
  timezone: string;
  restaurantId: string;
  bookingMap: Map<string, OpsEmailDeliveryBookingDTO>;
  page: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function OpsEmailDeliveryResultsCard({
  groups,
  timezone,
  restaurantId,
  bookingMap,
  page,
  hasNext,
  onPrev,
  onNext,
}: OpsEmailDeliveryResultsCardProps) {
  const count = groups.length;
  const items = useMemo(() => {
    return groups.map((group) => {
      const key = `${group.messageId}__${group.recipientEmail.toLowerCase()}`;
      const bookingId = groupBookingId(group);
      const booking = bookingId ? bookingMap.get(bookingId) ?? null : null;
      return { key, group, booking };
    });
  }, [bookingMap, groups]);

  return (
    <Card className="border-slate-200/60 bg-white">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Email Delivery
            </div>
            <Badge variant="secondary">{count}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
        <Separator />
        <Accordion type="multiple" className="space-y-2">
          {items.map(({ key, group, booking }) => (
            <AccordionItem key={key} value={key} className="border-none rounded-lg bg-slate-50/60">
              <AccordionTrigger className="min-w-0 px-3 py-2 hover:no-underline">
                <GroupHeader group={group} timezone={timezone} booking={booking} restaurantId={restaurantId} />
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <div className="space-y-2">
                  <div
                    className="max-w-full break-all text-xs font-mono text-slate-500 sm:truncate"
                    title={group.messageId}
                  >
                    messageId: {group.messageId}
                  </div>
                  {group.events.map((event) => {
                    const when = formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
                    return (
                      <div key={event.id} className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={event.status} />
                          <span className="text-xs text-slate-600">{when ?? 'Unknown time'}</span>
                        </div>
                        {event.error ? (
                          <span
                            className="min-w-0 max-w-[50%] truncate text-xs text-rose-700"
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
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
