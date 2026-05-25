'use client';

import { cn } from '@/lib/utils';

import type { OpsEmailDistributionSegment } from '../opsEmailDeliverySummaryMetricsDomain';

type OpsEmailDeliverySummaryDistributionProps = {
  distributionSegments: OpsEmailDistributionSegment[];
  distributionSummary: string;
};

export function OpsEmailDeliverySummaryDistribution({
  distributionSegments,
  distributionSummary,
}: OpsEmailDeliverySummaryDistributionProps) {
  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/10 p-3"
      aria-label="Status distribution"
      data-testid="email-delivery-distribution"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">Status distribution</div>
        <div className="text-xs text-muted-foreground">{distributionSummary}</div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="flex h-full w-full">
          {distributionSegments.map((segment) => {
            if (segment.widthPercent <= 0) {
              return null;
            }

            return (
              <div
                key={segment.status}
                className={cn('h-full', segment.className)}
                style={{ width: `${segment.widthPercent}%` }}
                title={segment.title}
              />
            );
          })}
        </div>
      </div>

      <div className="sr-only">
        {distributionSegments.map((segment) => (
          <div key={segment.status}>{segment.screenReaderText}</div>
        ))}
      </div>
    </div>
  );
}
