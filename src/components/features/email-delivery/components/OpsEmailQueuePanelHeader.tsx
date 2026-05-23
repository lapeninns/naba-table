'use client';

import {
  formatOpsEmailQueueDateTime,
  OPS_EMAIL_QUEUE_STATUS_OPTIONS,
} from '@/components/features/email-delivery/opsEmailQueuePanelDomain';
import { OPS_CARD_HEADER_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { OpsEmailQueueMetricsGrid } from './OpsEmailQueueMetricsGrid';

import type { OpsEmailQueuePanelState } from '../useOpsEmailQueuePanelState';

export type OpsEmailQueuePanelHeaderProps = {
  state: OpsEmailQueuePanelState;
  timezone: string;
};

export function OpsEmailQueuePanelHeader({ state, timezone }: OpsEmailQueuePanelHeaderProps) {
  return (
    <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'flex flex-col gap-4 border-b')}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            Scheduled email queue
          </CardTitle>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            See which booking emails are scheduled to send later, ready to go out now, currently
            being sent, or need follow-up.
          </p>
        </div>

        {state.query.response?.ok ? (
          <Badge
            variant="outline"
            className="w-fit border-border bg-muted/40 font-mono text-[11px] text-muted-foreground"
          >
            {formatOpsEmailQueueDateTime(state.query.response.timestamp, timezone)}
          </Badge>
        ) : null}
      </div>

      <OpsEmailQueueMetricsGrid metrics={state.queueMetrics} />

      <div className="flex flex-wrap gap-2">
        {OPS_EMAIL_QUEUE_STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={state.status === option.value ? 'default' : 'outline'}
            className={cn(
              'rounded-full px-3.5 text-xs font-semibold',
              state.status === option.value
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border-border bg-background text-foreground hover:bg-muted',
            )}
            onClick={() => state.handleStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </CardHeader>
  );
}
