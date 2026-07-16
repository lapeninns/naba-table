'use client';

import { AlertCircle, MessageSquare } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  formatSmsDeliveryOccurredAt,
  formatSmsProviderStatusLabel,
  formatSmsTypeLabel,
  getSmsDeliveryStatusBadgeTone,
  isSmsProviderStatusMoreSpecific,
  SMS_DELIVERY_STATUS_LABELS,
} from '@/src/lib/sms-delivery/presentation';

import { formatSmsStuckForHint } from '../opsSmsDeliveryDomain';

import type {
  OpsSmsDeliveryAttemptDTO,
  OpsSmsDeliveryFeedResponse,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

function SmsStatusBadge({ status }: { status: SmsDeliveryStatus }) {
  const tone = getSmsDeliveryStatusBadgeTone(status);
  return (
    <Badge
      variant={tone.variant}
      className={cn('text-[10px] font-bold uppercase tracking-wide', tone.className)}
    >
      {SMS_DELIVERY_STATUS_LABELS[status]}
    </Badge>
  );
}

function SmsDeliveryAttemptRow({
  attempt,
  timezone,
}: {
  attempt: OpsSmsDeliveryAttemptDTO;
  timezone: string;
}) {
  const isStale = attempt.isStale === true;
  const stuckHint = isStale ? formatSmsStuckForHint(attempt.stuckForMs) : null;
  const providerStatusLabel = isSmsProviderStatusMoreSpecific(
    attempt.currentStatus,
    attempt.currentProviderStatus,
  )
    ? formatSmsProviderStatusLabel(attempt.currentProviderStatus)
    : null;

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        isStale ? 'border-primary/30 bg-primary/10' : 'border-border',
      )}
      data-stale={isStale ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <SmsStatusBadge status={attempt.currentStatus} />
            {providerStatusLabel ? (
              <Badge
                variant="outline"
                className="text-[10px] font-medium normal-case text-muted-foreground"
                title="Raw provider status, more specific than the normalized status above"
              >
                {providerStatusLabel}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wide">
              {attempt.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              {attempt.fallbackForAttemptId ? ' fallback' : ''}
            </Badge>
            {isStale ? (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-[10px] font-bold uppercase tracking-wide text-primary"
                title="In flight for longer than the expected Twilio callback window"
              >
                Stuck{stuckHint ? ` · ${stuckHint}` : ''}
              </Badge>
            ) : null}
            <span className="text-sm font-medium text-foreground">
              {formatSmsTypeLabel(attempt.smsType)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {attempt.recipientPhone} ·{' '}
            {attempt.booking?.reference ? `Ref ${attempt.booking.reference}` : 'No booking link'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatSmsDeliveryOccurredAt(attempt.currentOccurredAt, timezone) ?? 'Unknown time'}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {attempt.events.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No timeline events recorded.</span>
        ) : (
          attempt.events.map((event) => {
            const eventProviderLabel = isSmsProviderStatusMoreSpecific(
              event.status,
              event.providerStatus,
            )
              ? formatSmsProviderStatusLabel(event.providerStatus)
              : null;
            const eventTime = formatSmsDeliveryOccurredAt(event.occurredAt, timezone);
            return (
              <Badge
                key={event.id}
                variant="outline"
                className="text-[10px]"
                title={eventTime ?? undefined}
              >
                {eventProviderLabel ?? SMS_DELIVERY_STATUS_LABELS[event.status]}
              </Badge>
            );
          })
        )}
      </div>
    </div>
  );
}

export type OpsSmsDeliveryLogProps = {
  unavailable: boolean;
  apiError: string | null;
  errorMessage: string | null;
  feed: Extract<OpsSmsDeliveryFeedResponse, { ok: true }> | null;
  timezone: string;
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function OpsSmsDeliveryLog({
  unavailable,
  apiError,
  errorMessage,
  feed,
  timezone,
  page,
  onPreviousPage,
  onNextPage,
}: OpsSmsDeliveryLogProps) {
  return (
    <section>
      {unavailable ? (
        <Alert className="border-border bg-muted/40">
          <AlertTitle>Delivery tracking unavailable</AlertTitle>
          <AlertDescription>
            This environment is not currently recording or exposing message delivery events.
          </AlertDescription>
        </Alert>
      ) : apiError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Unable to load message delivery attempts</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      ) : errorMessage ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Unexpected error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : feed ? (
        <Card className={OPS_CARD_CLASS}>
          <CardHeader className={OPS_CARD_HEADER_CLASS}>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4" aria-hidden />
              Message Delivery Log
            </CardTitle>
          </CardHeader>
          <CardContent className={OPS_CARD_CONTENT_CLASS}>
            {feed.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No message attempts found for this range/filter.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {feed.attempts.map((attempt) => (
                  <SmsDeliveryAttemptRow
                    key={`${attempt.messageSid}__${attempt.recipientPhone}`}
                    attempt={attempt}
                    timezone={timezone}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Page {feed.pageInfo.page}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={onPreviousPage}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!feed.pageInfo.hasNext}
                  onClick={onNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export default OpsSmsDeliveryLog;
