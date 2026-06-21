'use client';

import { ChevronDown } from 'lucide-react';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type {
  OpsEmailFailureList,
  OpsEmailSecondaryMetric,
} from '../opsEmailDeliverySummaryMetricsDomain';

type OpsEmailDeliverySummaryDetailsProps = {
  failureLists: OpsEmailFailureList[];
  secondaryMetrics: OpsEmailSecondaryMetric[];
};

function OpsEmailDeliverySecondaryMetric({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

function OpsEmailDeliveryFailureListCard({ failureList }: { failureList: OpsEmailFailureList }) {
  return (
    <Card className={cn(OPS_CARD_CLASS, 'bg-muted/10')}>
      <CardHeader className={OPS_CARD_HEADER_CLASS}>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {failureList.title}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(OPS_CARD_CONTENT_CLASS, 'flex flex-col gap-2')}>
        {failureList.entries.length > 0 ? (
          failureList.entries.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground" title={entry.label}>
                {entry.label}
              </span>
              <Badge variant="secondary">{entry.count}</Badge>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">{failureList.emptyLabel}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function OpsEmailDeliverySummaryDetails({
  failureLists,
  secondaryMetrics,
}: OpsEmailDeliverySummaryDetailsProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="group h-auto px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label="Toggle more metrics"
        >
          More metrics
          <ChevronDown
            data-icon="inline-end"
            className="transition-transform group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {secondaryMetrics.map((metric) => (
            <OpsEmailDeliverySecondaryMetric
              key={metric.key}
              label={metric.label}
              value={metric.value}
              testId={metric.testId}
            />
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {failureLists.map((failureList) => (
            <OpsEmailDeliveryFailureListCard key={failureList.key} failureList={failureList} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
