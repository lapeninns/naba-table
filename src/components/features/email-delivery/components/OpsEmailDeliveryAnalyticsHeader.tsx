'use client';

import { BarChart3 } from 'lucide-react';

import { OPS_CARD_HEADER_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Badge } from '@/components/ui/badge';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import {
  isOpsEmailDeliveryAnalyticsRange,
  OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS,
} from '../opsEmailDeliveryAnalyticsDomain';

import type { OpsEmailDeliveryRange } from '@/types/emailDelivery';

export type OpsEmailDeliveryAnalyticsHeaderProps = {
  isLoading: boolean;
  isUpdating: boolean;
  lastUpdatedAt?: number | null;
  onRangeChange: (range: OpsEmailDeliveryRange) => void;
  range: OpsEmailDeliveryRange;
};

export function OpsEmailDeliveryAnalyticsHeader({
  isLoading,
  isUpdating,
  lastUpdatedAt,
  onRangeChange,
  range,
}: OpsEmailDeliveryAnalyticsHeaderProps) {
  return (
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
          <AnalyticsStatusBadges
            isLoading={isLoading}
            isUpdating={isUpdating}
            lastUpdatedAt={lastUpdatedAt}
          />
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Measure delivery health over time with independent summary metrics, distribution, and
          failure hotspots.
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
            if (isOpsEmailDeliveryAnalyticsRange(value)) {
              onRangeChange(value);
            }
          }}
          className="justify-start rounded-full border border-border bg-muted/40 p-1"
          aria-label="Analytics time range"
        >
          {OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label={`Analytics range ${option}`}
            >
              {option}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </CardHeader>
  );
}

function AnalyticsStatusBadges({
  isLoading,
  isUpdating,
  lastUpdatedAt,
}: Pick<OpsEmailDeliveryAnalyticsHeaderProps, 'isLoading' | 'isUpdating' | 'lastUpdatedAt'>) {
  return (
    <>
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
    </>
  );
}
