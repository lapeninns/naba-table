'use client';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type {
  OpsEmailMetricTone,
  OpsEmailPrimaryMetric,
} from '../opsEmailDeliverySummaryMetricsDomain';
import type { EmailDeliveryStatus } from '@/types/emailDelivery';

type OpsEmailDeliverySummaryMetricCardsProps = {
  metrics: OpsEmailPrimaryMetric[];
  onFilterStatus?: (status: EmailDeliveryStatus | null) => void;
};

type OpsEmailDeliveryMetricTileProps = {
  label: string;
  value: string;
  hint?: string | null;
  tone?: OpsEmailMetricTone;
  onClick?: (() => void) | undefined;
  testId?: string;
};

function getMetricToneClass(tone?: OpsEmailMetricTone): string {
  if (tone === 'good' || tone === 'warn') {
    return 'border-primary/30 bg-primary/10';
  }

  if (tone === 'bad') {
    return 'border-destructive/20 bg-destructive/10';
  }

  return 'border-border/60 bg-muted/10';
}

function OpsEmailDeliveryMetricTile({
  label,
  value,
  hint,
  tone,
  onClick,
  testId,
}: OpsEmailDeliveryMetricTileProps) {
  const inner = (
    <Card
      className={cn(
        OPS_CARD_CLASS,
        getMetricToneClass(tone),
        onClick ? 'transition-colors hover:bg-muted/15' : null,
      )}
    >
      <CardHeader className={OPS_CARD_HEADER_CLASS}>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className={OPS_CARD_CONTENT_CLASS}>
        <p className="text-2xl font-semibold tracking-tight text-foreground" data-testid={testId}>
          {value}
        </p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (!onClick) {
    return inner;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
      onClick={onClick}
    >
      {inner}
    </Button>
  );
}

export function OpsEmailDeliverySummaryMetricCards({
  metrics,
  onFilterStatus,
}: OpsEmailDeliverySummaryMetricCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <OpsEmailDeliveryMetricTile
          key={metric.key}
          label={metric.label}
          value={metric.value}
          hint={metric.hint}
          tone={metric.tone}
          onClick={
            onFilterStatus && 'filterStatus' in metric
              ? () => onFilterStatus(metric.filterStatus ?? null)
              : undefined
          }
          testId={metric.testId}
        />
      ))}
    </div>
  );
}
