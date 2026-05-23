import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { OpsEmailAnalyticsDistributionSegment } from '../opsEmailDeliveryAnalyticsDomain';

export type OpsEmailDeliveryAnalyticsDistributionProps = {
  segments: OpsEmailAnalyticsDistributionSegment[];
  total: number;
};

export function OpsEmailDeliveryAnalyticsDistribution({
  segments,
  total,
}: OpsEmailDeliveryAnalyticsDistributionProps) {
  return (
    <div
      className="rounded-xl border border-border bg-muted/40 p-4"
      data-testid="analytics-distribution-bar"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">Status distribution</div>
          <p className="text-sm text-muted-foreground">
            Share of attempts by current delivery state.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-border bg-background text-xs text-muted-foreground"
        >
          {total} total attempts
        </Badge>
      </div>

      <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={cn('h-full', segment.toneClass)}
              style={{ width: `${segment.widthPercent}%` }}
              title={segment.title}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {segments.map((segment) => (
          <Badge
            key={segment.key}
            variant="outline"
            className="border-border bg-background text-xs text-muted-foreground"
          >
            <span
              className={cn('mr-2 inline-block size-2.5 rounded-full', segment.toneClass)}
              aria-hidden
            />
            {segment.label}: {segment.count}
          </Badge>
        ))}
      </div>
    </div>
  );
}
