'use client';

import { BarChart3 } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  EMAIL_DELIVERY_RANGE_OPTIONS,
  buildAnalyticsModel,
  isEmailDeliveryRange,
} from '../opsEmailDeliveryDomain';

import type { OpsEmailDeliveryRange, OpsEmailDeliverySummary } from '@/types/emailDelivery';

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
    <section aria-label="Email delivery analytics" className="space-y-6">
      <Card className={OPS_CARD_CLASS}>
        <CardHeader
          className={cn(
            OPS_CARD_HEADER_CLASS,
            'flex flex-col gap-4 border-b sm:flex-row sm:items-start sm:justify-between',
          )}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base font-semibold text-foreground">
                Delivery analytics
              </CardTitle>
              {lastUpdatedAt ? (
                <Badge
                  variant="outline"
                  className="border-border bg-muted/40 text-xs text-muted-foreground"
                >
                  Updated{' '}
                  {new Date(lastUpdatedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Badge>
              ) : null}
              {isUpdating && !isLoading ? (
                <Badge
                  variant="outline"
                  className="border-border bg-muted/40 text-xs text-muted-foreground"
                >
                  Updating…
                </Badge>
              ) : null}
            </div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Measure delivery health over time with summary metrics, distribution, and failure
              hotspots.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Time range
            </div>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(value) => {
                if (isEmailDeliveryRange(value)) onRangeChange(value);
              }}
              className="justify-start rounded-full border border-border bg-muted/40 p-1"
              aria-label="Analytics time range"
            >
              {EMAIL_DELIVERY_RANGE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  aria-label={`Analytics range ${option.value}`}
                >
                  {option.value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardHeader>

        <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-6 pt-4')}>
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTitle>Unable to load analytics</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          {isLoading && !summary ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : model ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {model.tiles.map((tile) => (
                  <Card key={tile.key} className={OPS_CARD_CLASS}>
                    <CardHeader className={OPS_CARD_HEADER_CLASS}>
                      <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {tile.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={OPS_CARD_CONTENT_CLASS}>
                      <p className="text-3xl font-semibold tracking-tight">{tile.value}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{tile.hint}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="text-sm font-semibold">Status distribution</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {model.distribution.map((segment) => (
                    <Badge key={segment.key} variant="outline" className="text-xs">
                      {segment.label}: {segment.count}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="border-border bg-background shadow-sm lg:col-span-1">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Secondary metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {model.secondary.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-xl border border-border bg-muted/40 px-4 py-3"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {metric.label}
                        </div>
                        <div className="mt-2 text-lg font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border bg-background shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Top failed templates</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {model.topFailedTemplates.length > 0 ? (
                      model.topFailedTemplates.map((entry) => (
                        <div
                          key={entry.templateType}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
                        >
                          <span className="truncate text-sm">{entry.templateType}</span>
                          <Badge variant="secondary">{entry.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No failed templates in this range.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border bg-background shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Top failed email types</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {model.topFailedEmailTypes.length > 0 ? (
                      model.topFailedEmailTypes.map((entry) => (
                        <div
                          key={entry.emailType}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
                        >
                          <span className="truncate text-sm">{entry.emailType}</span>
                          <Badge variant="secondary">{entry.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No failed email types in this range.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : !errorMessage ? (
            <Alert className="border-border bg-muted/40">
              <AlertTitle>Analytics unavailable</AlertTitle>
              <AlertDescription>
                Summary metrics could not be calculated for this range right now.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
