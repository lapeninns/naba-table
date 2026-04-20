'use client';

import { ChevronDown } from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';
import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
  getEmailDeliveryStatusBadgeTone,
} from '@src/lib/email-delivery/presentation';

import type { EmailDeliveryEventDTO, EmailDeliveryStatus, OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function parseIsoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function resolveSubject(events: EmailDeliveryEventDTO[]): string | null {
  for (const event of events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;
    const subject = (meta as { subject?: unknown }).subject;
    if (typeof subject === 'string' && subject.trim().length > 0) {
      return subject.trim();
    }
  }
  return null;
}

function resolveVariantName(events: EmailDeliveryEventDTO[]): string | null {
  for (const event of events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;

    const variantName = (meta as { variantName?: unknown }).variantName;
    if (typeof variantName === 'string' && variantName.trim().length > 0) {
      return variantName.trim();
    }

    const variantId = (meta as { variantId?: unknown }).variantId;
    if (typeof variantId === 'string' && variantId.trim().length > 0) {
      return variantId.trim();
    }
  }
  return null;
}

function resolveCurrentEvent(events: EmailDeliveryEventDTO[], fallbackStatus: EmailDeliveryStatus): EmailDeliveryEventDTO | null {
  let current: EmailDeliveryEventDTO | null = null;
  let currentMs: number | null = null;
  for (const event of events) {
    if (!event.occurredAt) continue;
    const ms = parseIsoMs(event.occurredAt);
    if (ms === null) continue;
    if (currentMs === null || ms > currentMs) {
      current = event;
      currentMs = ms;
    }
  }

  if (current) return current;
  return events.find((event) => event.status === fallbackStatus) ?? events[events.length - 1] ?? null;
}

function formatBookingStart(
  booking: NonNullable<OpsEmailDeliveryAttemptDTO['booking']>,
  timezone: string,
): string | null {
  const iso = `${booking.bookingDate}T${booking.startTime}`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return null;
  return dt.toFormat('EEE, MMM d · HH:mm');
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

function statusRailClass(status: EmailDeliveryStatus, isStale: boolean): string {
  if (isStale) {
    return 'border-l-4 border-amber-600';
  }
  switch (status) {
    case 'delivered':
      return 'border-l-4 border-emerald-500';
    case 'delivery_delayed':
      return 'border-l-4 border-amber-500';
    case 'bounced':
    case 'complained':
    case 'failed':
      return 'border-l-4 border-rose-500';
    case 'sent':
    default:
      return 'border-l-4 border-slate-300';
  }
}

function formatStuckForHint(stuckForMs: number | null | undefined): string | null {
  if (typeof stuckForMs !== 'number' || !Number.isFinite(stuckForMs) || stuckForMs <= 0) return null;
  const hours = Math.floor(stuckForMs / (60 * 60 * 1000));
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    return `stuck ${days}d`;
  }
  if (hours >= 1) return `stuck ${hours}h`;
  const mins = Math.max(1, Math.floor(stuckForMs / 60000));
  return `stuck ${mins}m`;
}

export type OpsEmailDeliveryAttemptCardProps = {
  attempt: OpsEmailDeliveryAttemptDTO;
  timezone: string;
  restaurantId: string;
};

export function OpsEmailDeliveryAttemptCard({ attempt, timezone, restaurantId }: OpsEmailDeliveryAttemptCardProps) {
  const subject =
    resolveSubject(attempt.events) ?? attempt.templateType ?? attempt.emailType ?? 'Email';
  const variantName = resolveVariantName(attempt.events);
  const when = formatEmailDeliveryOccurredAt(attempt.currentOccurredAt, timezone);
  const booking = attempt.booking;
  const bookingStart = booking ? formatBookingStart(booking, timezone) : null;
  const currentEvent = resolveCurrentEvent(attempt.events, attempt.currentStatus);

  const bookingHref =
    attempt.bookingId ? `/app/bookings?restaurantId=${restaurantId}&focus=${attempt.bookingId}` : null;

  const isLongRecipient = attempt.recipientEmail.length > 38;

  const isStale = attempt.isStale === true;
  const stuckHint = isStale ? formatStuckForHint(attempt.stuckForMs) : null;

  return (
    <Card
      className={cn(
        'border-slate-200/60 bg-white',
        statusRailClass(attempt.currentStatus, isStale),
        isStale && 'bg-amber-50/40',
      )}
      data-attempt-key={`${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`}
      data-stale={isStale ? 'true' : undefined}
    >
      <CardContent className="p-4">
        <Collapsible>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex items-center gap-2">
                <StatusBadge status={attempt.currentStatus} />
                {isStale ? (
                  <Badge
                    variant="outline"
                    className="border-amber-400 bg-amber-100 text-[10px] font-bold uppercase tracking-wide text-amber-900"
                    title="Accepted by the provider but no delivery receipt received"
                  >
                    Stuck{stuckHint ? ` · ${stuckHint}` : ''}
                  </Badge>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-sm font-semibold text-slate-900" title={subject}>
                    {subject}
                  </div>
                  {variantName ? (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {variantName}
                    </Badge>
                  ) : null}
                  {attempt.templateType && attempt.templateType !== subject ? (
                    <Badge variant="secondary" className="hidden sm:inline-flex">
                      {attempt.templateType}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span
                    className={cn('max-w-full break-all', isLongRecipient ? null : 'sm:truncate')}
                    title={attempt.recipientEmail}
                  >
                    {attempt.recipientEmail}
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
                  {currentEvent?.error ? (
                    <span className="max-w-full truncate text-rose-700" title={currentEvent.error}>
                      {currentEvent.error}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {bookingHref ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden h-7 shrink-0 px-2 text-xs sm:inline-flex"
                >
                  <Link href={bookingHref} prefetch={false}>
                    Open booking
                  </Link>
                </Button>
              ) : null}

              <CopyButton text={attempt.messageId} label="message id" className="h-7 w-7" />

              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="group h-7 w-7"
                  aria-label="Toggle attempt details"
                >
                  <ChevronDown
                    className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180"
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Message id
                </div>
                <div className="max-w-full break-all font-mono text-xs text-slate-600" title={attempt.messageId}>
                  {attempt.messageId}
                </div>
              </div>
              <CopyButton text={attempt.messageId} label="message id" variant="outline" size="sm" />
            </div>

            <div className="space-y-2">
              {attempt.events.map((event) => {
                const eventWhen = formatEmailDeliveryOccurredAt(event.occurredAt, timezone) ?? event.occurredAt;
                return (
                  <div key={event.id} className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={event.status} />
                      <span className="text-xs text-slate-600">{eventWhen ?? 'Unknown time'}</span>
                    </div>
                    {event.error ? (
                      <span className="min-w-0 max-w-[55%] truncate text-xs text-rose-700" title={event.error}>
                        {event.error}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
