'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { CommunicationsDeliveryOverviewMetric } from '../communicationsDeliveryTypes';

export type CommunicationsDeliveryMetricGridProps = {
  /** Accessible name for the metrics region. */
  label: string;
  isLoading: boolean;
  metrics: CommunicationsDeliveryOverviewMetric[];
  /** Skeleton count while loading; matches the loaded metric count so nothing jumps. */
  skeletonCount?: number;
  className?: string;
};

/**
 * The one metric-card pattern for Communications Delivery: eyebrow label, 2xl semibold value,
 * caption hint. One column on phones, two from `sm`, four from `lg`.
 */
export function CommunicationsDeliveryMetricGrid({
  label,
  isLoading,
  metrics,
  skeletonCount = 4,
  className,
}: CommunicationsDeliveryMetricGridProps) {
  return (
    <section
      aria-label={label}
      aria-busy={isLoading || undefined}
      className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}
    >
      {isLoading
        ? Array.from({ length: skeletonCount }, (_, index) => (
            <Card key={index} className={OPS_CARD_CLASS} data-testid="comms-metric-skeleton">
              <div className={cn(OPS_CARD_HEADER_CLASS, 'flex flex-col gap-2')}>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </Card>
          ))
        : metrics.map((metric) => (
            <Card key={metric.label} className={OPS_CARD_CLASS}>
              <dl className={cn(OPS_CARD_HEADER_CLASS, 'flex flex-col gap-1')}>
                <Text as="dt" variant="eyebrow">
                  {metric.label}
                </Text>
                <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {metric.value}
                </dd>
                <Text as="dd" variant="caption" className="min-h-5 tabular-nums">
                  {metric.hint ?? ''}
                </Text>
              </dl>
            </Card>
          ))}
    </section>
  );
}
