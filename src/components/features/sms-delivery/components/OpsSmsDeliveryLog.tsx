'use client';

import { AlertCircle, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';

import { COMMS_CONTROL_HEIGHT_CLASS } from '@/components/features/communications-delivery/components/communicationsDeliveryClasses';
import { CommunicationsDeliveryTableRegion } from '@/components/features/communications-delivery/components/CommunicationsDeliveryTableRegion';
import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  formatSmsDeliveryOccurredAt,
  formatSmsProviderStatusLabel,
  formatSmsTypeLabel,
  getSmsDeliveryStatusTone,
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
  return (
    <OpsStatusBadge
      label={SMS_DELIVERY_STATUS_LABELS[status]}
      tone={getSmsDeliveryStatusTone(status)}
    />
  );
}

type AttemptView = {
  attempt: OpsSmsDeliveryAttemptDTO;
  isStale: boolean;
  stuckHint: string | null;
  providerStatusLabel: string | null;
  timeLabel: string;
};

function toAttemptView(attempt: OpsSmsDeliveryAttemptDTO, timezone: string): AttemptView {
  const isStale = attempt.isStale === true;
  return {
    attempt,
    isStale,
    stuckHint: isStale ? formatSmsStuckForHint(attempt.stuckForMs) : null,
    providerStatusLabel: isSmsProviderStatusMoreSpecific(
      attempt.currentStatus,
      attempt.currentProviderStatus,
    )
      ? formatSmsProviderStatusLabel(attempt.currentProviderStatus)
      : null,
    timeLabel: formatSmsDeliveryOccurredAt(attempt.currentOccurredAt, timezone) ?? 'Unknown time',
  };
}

/** Status, raw provider status and the stuck flag — never colour alone. */
function AttemptStatus({ view }: { view: AttemptView }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SmsStatusBadge status={view.attempt.currentStatus} />
      {view.providerStatusLabel ? (
        <OpsStatusBadge
          tone="muted"
          label={
            <span title="Raw provider status, more specific than the normalized status">
              {view.providerStatusLabel}
            </span>
          }
        />
      ) : null}
      {view.isStale ? (
        <OpsStatusBadge
          tone="warning"
          label={
            <span title="In flight for longer than the expected Twilio callback window">
              Stuck{view.stuckHint ? ` · ${view.stuckHint}` : ''}
            </span>
          }
        />
      ) : null}
    </div>
  );
}

/** Channel is an attribute, not a status: an outline pill, with the fallback called out. */
function AttemptChannel({ attempt }: { attempt: OpsSmsDeliveryAttemptDTO }) {
  return (
    <Badge variant="outline" className="whitespace-nowrap text-xs font-semibold uppercase">
      {attempt.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
      {attempt.fallbackForAttemptId ? ' fallback' : ''}
    </Badge>
  );
}

function AttemptTimeline({
  attempt,
  timezone,
}: {
  attempt: OpsSmsDeliveryAttemptDTO;
  timezone: string;
}) {
  if (attempt.events.length === 0) {
    return <span className="text-xs text-muted-foreground">No timeline events recorded.</span>;
  }
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Status timeline">
      {attempt.events.map((event) => {
        const eventProviderLabel = isSmsProviderStatusMoreSpecific(
          event.status,
          event.providerStatus,
        )
          ? formatSmsProviderStatusLabel(event.providerStatus)
          : null;
        const eventTime = formatSmsDeliveryOccurredAt(event.occurredAt, timezone);
        return (
          <li key={event.id}>
            <Badge variant="outline" className="text-xs font-normal" title={eventTime ?? undefined}>
              {eventProviderLabel ?? SMS_DELIVERY_STATUS_LABELS[event.status]}
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}

function AttemptCard({ view, timezone }: { view: AttemptView; timezone: string }) {
  const { attempt } = view;
  return (
    <article
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
      data-stale={view.isStale ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AttemptStatus view={view} />
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {view.timeLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AttemptChannel attempt={attempt} />
        <Text as="span" variant="label">
          {formatSmsTypeLabel(attempt.smsType)}
        </Text>
      </div>
      <Text variant="caption" className="break-words">
        <span className="font-mono tabular-nums">{attempt.recipientPhone}</span> ·{' '}
        {attempt.booking?.reference ? (
          <span className="font-mono">Ref {attempt.booking.reference}</span>
        ) : (
          'No booking link'
        )}
      </Text>
      <AttemptTimeline attempt={attempt} timezone={timezone} />
    </article>
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
  const views = feed ? feed.attempts.map((attempt) => toAttemptView(attempt, timezone)) : [];
  return (
    <section>
      {unavailable ? (
        <Alert variant="info">
          <AlertCircle className="size-4" aria-hidden />
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
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
              Message Delivery Log
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pb-[var(--pg-density-card-py)]')}>
            {feed.attempts.length === 0 ? (
              <OpsEmptyState
                size="compact"
                title="No message attempts found"
                description="No message attempts found for this range/filter."
              />
            ) : (
              <>
                <ul className="flex flex-col gap-3 lg:hidden" aria-label="Message attempts">
                  {views.map((view) => (
                    <li key={`${view.attempt.messageSid}__${view.attempt.recipientPhone}`}>
                      <AttemptCard view={view} timezone={timezone} />
                    </li>
                  ))}
                </ul>
                <CommunicationsDeliveryTableRegion
                  label="Message attempts"
                  hintBelow="none"
                  className="hidden lg:flex"
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead className="text-right">Latest update</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {views.map((view) => (
                        <TableRow
                          key={`${view.attempt.messageSid}__${view.attempt.recipientPhone}`}
                          data-stale={view.isStale ? 'true' : undefined}
                        >
                          <TableCell className="align-top">
                            <AttemptStatus view={view} />
                          </TableCell>
                          <TableCell className="align-top">
                            <AttemptChannel attempt={view.attempt} />
                          </TableCell>
                          <TableCell className="align-top text-sm">
                            {formatSmsTypeLabel(view.attempt.smsType)}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="font-mono text-xs tabular-nums">
                              {view.attempt.recipientPhone}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {view.attempt.booking?.reference ? (
                                <span className="font-mono">
                                  Ref {view.attempt.booking.reference}
                                </span>
                              ) : (
                                'No booking link'
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <AttemptTimeline attempt={view.attempt} timezone={timezone} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right align-top font-mono text-xs tabular-nums text-muted-foreground">
                            {view.timeLabel}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CommunicationsDeliveryTableRegion>
              </>
            )}

            <nav
              aria-label="Message attempts pagination"
              className="mt-4 flex items-center justify-between gap-3"
            >
              <Text variant="caption" className="tabular-nums">
                Page {feed.pageInfo.page}
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={COMMS_CONTROL_HEIGHT_CLASS}
                  disabled={page <= 1}
                  onClick={onPreviousPage}
                >
                  <ChevronLeft data-icon="inline-start" aria-hidden />
                  Prev
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={COMMS_CONTROL_HEIGHT_CLASS}
                  disabled={!feed.pageInfo.hasNext}
                  onClick={onNextPage}
                >
                  Next
                  <ChevronRight data-icon="inline-end" aria-hidden />
                </Button>
              </div>
            </nav>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export default OpsSmsDeliveryLog;
