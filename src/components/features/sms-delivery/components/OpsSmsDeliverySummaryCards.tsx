'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { getSmsDeliveryFailureCount, getSmsDeliveryRatePercent } from '../opsSmsDeliveryDomain';

import type { OpsSmsDeliverySummary } from '@/types/smsDelivery';

export type OpsSmsDeliverySummaryCardsProps = {
  isLoading: boolean;
  summary: OpsSmsDeliverySummary | null;
};

export function OpsSmsDeliverySummaryCards({
  isLoading,
  summary,
}: OpsSmsDeliverySummaryCardsProps) {
  const metrics = summary
    ? [
        { label: 'Total attempts', value: String(summary.total) },
        { label: 'Delivered rate', value: `${getSmsDeliveryRatePercent(summary.deliveredRate)}%` },
        { label: 'Failures', value: String(getSmsDeliveryFailureCount(summary)) },
        { label: 'Unique recipients', value: String(summary.uniqueRecipients) },
      ]
    : null;

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading || !metrics
        ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className={OPS_CARD_CLASS}>
              <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pt-4')}>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))
        : metrics.map((metric) => (
            <Card key={metric.label} className={OPS_CARD_CLASS}>
              <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'pt-4')}>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-semibold">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
    </section>
  );
}

export default OpsSmsDeliverySummaryCards;
