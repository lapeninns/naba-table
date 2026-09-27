'use client';

import { BarChart3 } from 'lucide-react';

import { COMMS_CONTROL_HEIGHT_CLASS } from '@/components/features/communications-delivery/components/communicationsDeliveryClasses';
import { CommunicationsDeliveryMetricGrid } from '@/components/features/communications-delivery/components/CommunicationsDeliveryMetricGrid';
import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import {
  EMAIL_DELIVERY_RANGE_OPTIONS,
  buildAnalyticsModel,
  isEmailDeliveryRange,
} from '../opsEmailDeliveryDomain';

import type { OpsStatusTone } from '@/lib/ops/status-tones';
import type { OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';

/** Distribution segments are delivery statuses; reuse the semantic tones. */
const DISTRIBUTION_TONES: Record<string, OpsStatusTone> = {
  delivered: 'success',
  sent: 'info',
  delayed: 'warning',
  bounced: 'danger',
  failed: 'danger',
};

function RankedList({
  title,
  entries,
  emptyLabel,
}: {
  title: string;
  entries: Array<{ key: string; label: string; count: number }>;
  emptyLabel: string;
}) {
  return (
    <Card className={OPS_CARD_CLASS}>
      <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'pb-2')}>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pb-[var(--pg-density-card-py)]')}>
        {entries.length > 0 ? (
          <ol className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-words">{entry.label}</span>
                <span className="font-semibold tabular-nums">{entry.count}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Text variant="caption">{emptyLabel}</Text>
        )}
      </CardContent>
    </Card>
  );
}

export type OpsEmailDeliveryAnalyticsProps = {
  summary: OpsEmailDeliverySummary | null;
  isLoading: boolean;
  isUpdating: boolean;
  range: OpsEmailDeliveryRange;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  errorMessage?: string | null;
  lastUpdatedAt?: number | null;
};

export function OpsEmailDeliveryAnalytics({
  summary,
  isLoading,
  isUpdating,
  range,
  onRangeChange,
  errorMessage,
  lastUpdatedAt,
}: OpsEmailDeliveryAnalyticsProps) {
  const model = summary ? buildAnalyticsModel(summary) : null;

  return (
    <section aria-labelledby="email-delivery-analytics-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
            <h2
              id="email-delivery-analytics-title"
              className="text-base font-semibold text-foreground"
            >
              Delivery analytics
            </h2>
            {lastUpdatedAt ? (
              <Badge
                variant="outline"
                className="font-mono text-xs tabular-nums text-muted-foreground"
              >
                Updated{' '}
                {new Date(lastUpdatedAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Badge>
            ) : null}
            {isUpdating && !isLoading ? <OpsStatusBadge tone="muted" label="Updating…" /> : null}
          </div>
          <Text variant="caption" className="max-w-[65ch]">
            Measure delivery health over time with summary metrics, distribution, and failure
            hotspots.
          </Text>
        </div>

        <Select
          value={range}
          onValueChange={(value) => {
            if (isEmailDeliveryRange(value)) onRangeChange(value);
          }}
        >
          <SelectTrigger
            className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'w-full sm:w-auto sm:min-w-[160px] max-w-full')}
            aria-label="Analytics time range"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.ariaLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load analytics</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {(isLoading && !summary) || model ? (
        <CommunicationsDeliveryMetricGrid
          label="Email delivery metrics"
          isLoading={isLoading && !summary}
          metrics={model?.tiles ?? []}
        />
      ) : null}

      {model ? (
        <>
          <Card className={OPS_CARD_CLASS}>
            <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'pb-2')}>
              <CardTitle className="text-sm font-semibold">Status distribution</CardTitle>
            </CardHeader>
            <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pb-[var(--pg-density-card-py)]')}>
              <ul className="flex flex-wrap gap-2">
                {model.distribution.map((segment) => (
                  <li key={segment.key}>
                    <OpsStatusBadge
                      tone={DISTRIBUTION_TONES[segment.key] ?? 'muted'}
                      label={
                        <span className="tabular-nums">
                          {segment.label}: {segment.count}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className={cn(OPS_CARD_CLASS, 'md:col-span-2 lg:col-span-1')}>
              <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'pb-2')}>
                <CardTitle className="text-sm font-semibold">Secondary metrics</CardTitle>
              </CardHeader>
              <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pb-[var(--pg-density-card-py)]')}>
                <dl className="divide-y divide-border">
                  {model.secondary.map((metric) => (
                    <div
                      key={metric.label}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                      <dd className="text-sm font-semibold tabular-nums">{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <RankedList
              title="Top failed templates"
              entries={model.topFailedTemplates.map((entry) => ({
                key: entry.templateType,
                label: entry.templateType,
                count: entry.count,
              }))}
              emptyLabel="No failed templates in this range."
            />

            <RankedList
              title="Top failed email types"
              entries={model.topFailedEmailTypes.map((entry) => ({
                key: entry.emailType,
                label: entry.emailType,
                count: entry.count,
              }))}
              emptyLabel="No failed email types in this range."
            />
          </div>
        </>
      ) : !errorMessage && !isLoading ? (
        <Alert variant="info">
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>
            Summary metrics could not be calculated for this range right now.
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
