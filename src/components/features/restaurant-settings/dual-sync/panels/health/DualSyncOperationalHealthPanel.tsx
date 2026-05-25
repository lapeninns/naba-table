/**
 * Restaurant-scoped dual-sync operational health panel.
 *
 * Uses the lazy metrics query from `useOpsDualSync` so operators can see
 * queue pressure, dead letters, quota failures, and partial publishes
 * without loading dashboard data on the main shell path.
 */

'use client';

import { DualSyncOperationalHealthContent } from './DualSyncOperationalHealthContent';
import {
  DualSyncOperationalHealthEmptyState,
  DualSyncOperationalHealthErrorState,
  DualSyncOperationalHealthLoadingState,
} from './DualSyncOperationalHealthStates';

import type { GetDualSyncMetricsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncOperationalHealthPanelProps {
  readonly metricsQuery: UseQueryResult<GetDualSyncMetricsResponse, Error>;
  readonly className?: string;
}

export function DualSyncOperationalHealthPanel({
  metricsQuery,
  className,
}: DualSyncOperationalHealthPanelProps) {
  const metrics = metricsQuery.data ?? null;

  if (metricsQuery.isLoading) {
    return <DualSyncOperationalHealthLoadingState className={className} />;
  }

  if (metricsQuery.isError) {
    return (
      <DualSyncOperationalHealthErrorState
        className={className}
        message={metricsQuery.error?.message ?? 'Unknown error.'}
        onRetry={() => metricsQuery.refetch()}
      />
    );
  }

  if (!metrics) {
    return <DualSyncOperationalHealthEmptyState className={className} />;
  }

  return (
    <DualSyncOperationalHealthContent
      className={className}
      metrics={metrics}
      onRefresh={() => metricsQuery.refetch()}
    />
  );
}
