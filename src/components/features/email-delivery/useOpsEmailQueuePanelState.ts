'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  buildOpsEmailQueueMetrics,
  getOpsEmailQueueTotal,
  resolveOpsEmailQueueQueryStatus,
  type OpsEmailQueueStatusFilter,
} from '@/components/features/email-delivery/opsEmailQueuePanelDomain';
import { useOpsEmailQueueFeed } from '@/hooks/ops/useOpsEmailQueueFeed';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';

export type OpsEmailQueueRefreshState = {
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
};

export type UseOpsEmailQueuePanelStateParams = {
  enabled: boolean;
  fixture: string | null;
  onRefreshStateChange?: (state: OpsEmailQueueRefreshState) => void;
  refetchIntervalMs?: number | false;
  refreshKey: number;
  restaurantId: string | null;
};

export function useOpsEmailQueuePanelState({
  enabled,
  fixture,
  onRefreshStateChange,
  refetchIntervalMs,
  refreshKey,
  restaurantId,
}: UseOpsEmailQueuePanelStateParams) {
  const [status, setStatus] = useState<OpsEmailQueueStatusFilter>('all');
  const [page, setPage] = useState(1);
  const lastHandledRefreshKeyRef = useRef(0);
  const shouldForceFixtureLoadingMarker = fixture === 'loading' && enabled;

  useEffect(() => {
    setPage(1);
  }, [restaurantId]);

  const query = useOpsEmailQueueFeed({
    enabled,
    fixture: fixture ?? undefined,
    page,
    pageSize: 25,
    refetchIntervalMs: enabled ? refetchIntervalMs : false,
    restaurantId,
    status: resolveOpsEmailQueueQueryStatus(status),
  });

  const jobs = query.jobs ?? [];
  const summary = query.summary;
  const total = getOpsEmailQueueTotal(query.response);
  const showLoadingState = useMinimumDelay(query.isLoading || query.isFetching, {
    delayMs: 0,
    minDurationMs: 400,
  });
  const showRefetchIndicator =
    (showLoadingState || shouldForceFixtureLoadingMarker) && jobs.length > 0;
  const queueMetrics = buildOpsEmailQueueMetrics(summary);

  useEffect(() => {
    onRefreshStateChange?.({
      isRefreshing: query.isFetching,
      lastUpdatedAt: query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null,
    });
  }, [onRefreshStateChange, query.dataUpdatedAt, query.isFetching]);

  const { refetch } = query;
  useEffect(() => {
    if (!enabled || refreshKey === 0) {
      return;
    }
    if (lastHandledRefreshKeyRef.current === refreshKey) {
      return;
    }
    lastHandledRefreshKeyRef.current = refreshKey;
    void refetch();
  }, [enabled, refetch, refreshKey]);

  const handleStatusChange = useCallback((nextStatus: OpsEmailQueueStatusFilter) => {
    setStatus(nextStatus);
    setPage(1);
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setPage((current) => Math.max(1, current - 1));
  }, []);

  return {
    handleNextPage,
    handlePreviousPage,
    handleStatusChange,
    jobs,
    page,
    query,
    queueMetrics,
    shouldForceFixtureLoadingMarker,
    showLoadingState,
    showRefetchIndicator,
    status,
    total,
  };
}

export type OpsEmailQueuePanelState = ReturnType<typeof useOpsEmailQueuePanelState>;
