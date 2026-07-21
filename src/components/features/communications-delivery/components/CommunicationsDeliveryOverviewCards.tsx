'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import type { CommunicationsDeliveryOverviewMetric } from '../communicationsDeliveryTypes';

export type CommunicationsDeliveryOverviewCardsProps = {
  isLoading: boolean;
  metrics: CommunicationsDeliveryOverviewMetric[];
};

export function CommunicationsDeliveryOverviewCards({
  isLoading,
  metrics,
}: CommunicationsDeliveryOverviewCardsProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {isLoading
        ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className={OPS_CARD_CLASS}>
              <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pt-4')}>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        : metrics.map((metric) => (
            <Card key={metric.label} className={OPS_CARD_CLASS}>
              <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-1 pt-4')}>
                <Text variant="eyebrow">{metric.label}</Text>
                <p className="text-2xl font-semibold text-foreground">{metric.value}</p>
                {metric.hint ? (
                  <Text variant="caption">{metric.hint}</Text>
                ) : (
                  <div className="h-5" />
                )}
              </CardContent>
            </Card>
          ))}
    </section>
  );
}
