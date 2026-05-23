'use client';

import { OPS_CARD_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { Card } from '@/components/ui/card';

import { OpsEmailQueuePanelContent } from './OpsEmailQueuePanelContent';
import { OpsEmailQueuePanelHeader } from './OpsEmailQueuePanelHeader';
import {
  useOpsEmailQueuePanelState,
  type OpsEmailQueueRefreshState,
} from '../useOpsEmailQueuePanelState';

export type OpsEmailQueuePanelProps = {
  restaurantId: string | null;
  timezone: string;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
  refreshKey?: number;
  fixture?: string | null;
  onRefreshStateChange?: (state: OpsEmailQueueRefreshState) => void;
};

export function OpsEmailQueuePanel({
  restaurantId,
  timezone,
  enabled = true,
  refetchIntervalMs = false,
  refreshKey = 0,
  fixture = null,
  onRefreshStateChange,
}: OpsEmailQueuePanelProps) {
  const state = useOpsEmailQueuePanelState({
    enabled,
    fixture,
    onRefreshStateChange,
    refetchIntervalMs,
    refreshKey,
    restaurantId,
  });

  return (
    <section aria-label="Queue monitor">
      <Card className={OPS_CARD_CLASS}>
        <OpsEmailQueuePanelHeader state={state} timezone={timezone} />
        <OpsEmailQueuePanelContent restaurantId={restaurantId} state={state} timezone={timezone} />
      </Card>
    </section>
  );
}
