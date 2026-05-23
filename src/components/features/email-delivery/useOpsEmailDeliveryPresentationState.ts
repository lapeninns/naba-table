import { useCallback, useEffect, useState } from 'react';

import {
  canInjectDeliveryLogError,
  DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
  DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS,
  formatRefreshLabel,
  formatRelativeSeconds,
  getDeliveryFeedErrorMessage,
  resolveActiveRefreshState,
  resolveDeliveryLogErrorMessage,
  resolvePaginationState,
  shouldShowEmailDeliveryEmptyGuidance,
  type OpsEmailDeliveryErrorLike,
  type OpsEmailDeliveryPageInfo,
} from '@/components/features/email-delivery/opsEmailDeliveryStateDomain';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';

import type {
  EmailDeliveryTab,
  OpsEmailDeliveryRefreshOption,
} from '@/components/features/email-delivery/opsEmailDeliveryTypes';

type RefetchableQuery = {
  apiError?: OpsEmailDeliveryErrorLike | Error | null;
  dataUpdatedAt: number;
  error?: OpsEmailDeliveryErrorLike | Error | null;
  isFetching: boolean;
  isLoading?: boolean;
  refetch: () => unknown;
  unavailable?: boolean;
};

type DeliveryFeedQuery = RefetchableQuery & {
  response?: { ok: boolean; pageInfo?: OpsEmailDeliveryPageInfo } | null;
};

type EmailDeliveryPresentationQueryState = {
  applyPage: (nextPage: number) => void;
  messageId: string | null;
  page: number;
  pageSize: number;
  refresh: OpsEmailDeliveryRefreshOption;
  simulateEmailDeliveryError: boolean;
  tab: EmailDeliveryTab;
};

type EmailDeliveryPresentationDataState = {
  analyticsQuery: RefetchableQuery;
  feedQuery: DeliveryFeedQuery;
  rows: Array<unknown>;
  summary: { total: number } | null;
};

type UseOpsEmailDeliveryPresentationStateOptions = {
  dataState: EmailDeliveryPresentationDataState;
  initialPageSize: number;
  pathname: string | null;
  queryState: EmailDeliveryPresentationQueryState;
};

export function useOpsEmailDeliveryPresentationState({
  dataState,
  initialPageSize,
  pathname,
  queryState,
}: UseOpsEmailDeliveryPresentationStateOptions) {
  const [manualRefreshNonce, setManualRefreshNonce] = useState(0);
  const [queueRefreshState, setQueueRefreshState] = useState<{
    isRefreshing: boolean;
    lastUpdatedAt: number | null;
  }>({ isRefreshing: false, lastUpdatedAt: null });
  const [relativeRefreshNow, setRelativeRefreshNow] = useState(() => Date.now());
  const [stuckLoadingFallbackActive, setStuckLoadingFallbackActive] = useState(false);

  const { activeLastUpdatedAt, activeIsRefreshing } = resolveActiveRefreshState({
    activeTab: queryState.tab,
    analyticsDataUpdatedAt: dataState.analyticsQuery.dataUpdatedAt,
    analyticsIsFetching: dataState.analyticsQuery.isFetching,
    feedDataUpdatedAt: dataState.feedQuery.dataUpdatedAt,
    feedIsFetching: dataState.feedQuery.isFetching,
    queueIsRefreshing: queueRefreshState.isRefreshing,
    queueLastUpdatedAt: queueRefreshState.lastUpdatedAt,
  });

  const manualRefreshBusy = useMinimumDelay(activeIsRefreshing, {
    delayMs: 0,
    minDurationMs: 450,
  });
  const autoRefreshActive = queryState.refresh !== 'off';

  useEffect(() => {
    if (!autoRefreshActive) return;
    setRelativeRefreshNow(Date.now());
    const intervalId = window.setInterval(() => {
      setRelativeRefreshNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeLastUpdatedAt, autoRefreshActive]);

  useEffect(() => {
    if (!dataState.feedQuery.isLoading) {
      setStuckLoadingFallbackActive(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStuckLoadingFallbackActive(true);
    }, DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dataState.feedQuery.isLoading]);

  const pageInfo =
    dataState.feedQuery.response?.ok && dataState.feedQuery.response.pageInfo
      ? dataState.feedQuery.response.pageInfo
      : null;
  const totalResults = dataState.summary?.total ?? 0;
  const paginationState = resolvePaginationState({
    currentRowCount: dataState.rows.length,
    initialPageSize,
    pageInfo,
    requestedPage: queryState.page,
    requestedPageSize: queryState.pageSize,
    totalResults,
  });

  const deliveryLogErrorMessage = dataState.feedQuery.apiError
    ? getDeliveryFeedErrorMessage(dataState.feedQuery.apiError)
    : dataState.feedQuery.error
      ? getDeliveryFeedErrorMessage(dataState.feedQuery.error)
      : null;

  const effectiveDeliveryLogErrorMessage = resolveDeliveryLogErrorMessage({
    baseErrorMessage: deliveryLogErrorMessage,
    messageId: queryState.messageId,
    simulateEmailDeliveryError: queryState.simulateEmailDeliveryError,
    stuckLoadingFallbackActive,
  });

  const shouldShowEmptyGuidance = shouldShowEmailDeliveryEmptyGuidance({
    effectiveDeliveryLogErrorMessage,
    feedUnavailable: Boolean(dataState.feedQuery.unavailable),
    isFeedLoading: Boolean(dataState.feedQuery.isLoading),
    rowCount: dataState.rows.length,
    stuckLoadingFallbackActive,
  });

  const canInjectDeliveryLogErrorValue = canInjectDeliveryLogError({
    appEnv: process.env.NEXT_PUBLIC_APP_ENV,
    nodeEnv: process.env.NODE_ENV,
    pathname,
  });

  const handlePrev = useCallback(() => {
    const nextPage = Math.max(1, queryState.page - 1);
    if (nextPage === queryState.page) return;
    queryState.applyPage(nextPage);
  }, [queryState]);

  const handleNext = useCallback(() => {
    if (!pageInfo?.hasNext) return;
    queryState.applyPage(queryState.page + 1);
  }, [pageInfo?.hasNext, queryState]);

  const handleManualRefresh = useCallback(() => {
    if (queryState.tab === 'delivery-log') {
      void dataState.feedQuery.refetch();
      return;
    }

    if (queryState.tab === 'analytics') {
      void dataState.analyticsQuery.refetch();
      return;
    }

    setManualRefreshNonce((value) => value + 1);
  }, [dataState.analyticsQuery, dataState.feedQuery, queryState.tab]);

  const analyticsErrorMessage = dataState.analyticsQuery.apiError
    ? getDeliveryFeedErrorMessage(dataState.analyticsQuery.apiError)
    : dataState.analyticsQuery.error
      ? getDeliveryFeedErrorMessage(dataState.analyticsQuery.error)
      : null;

  return {
    activeLastUpdatedAt,
    analyticsErrorMessage,
    autoRefreshActive,
    canInjectDeliveryLogError: canInjectDeliveryLogErrorValue,
    currentPage: paginationState.currentPage,
    currentPageSize: paginationState.currentPageSize,
    DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
    effectiveDeliveryLogErrorMessage,
    endResult: paginationState.endResult,
    formatRefreshLabel,
    handleManualRefresh,
    handleNext,
    handlePrev,
    hasNextPage: paginationState.hasNextPage,
    hasPrevPage: paginationState.hasPrevPage,
    manualRefreshBusy,
    manualRefreshNonce,
    pageInfo,
    queueRefreshState,
    refreshIndicatorText: autoRefreshActive
      ? formatRelativeSeconds(activeLastUpdatedAt, relativeRefreshNow)
      : null,
    setQueueRefreshState,
    shouldShowEmptyGuidance,
    shouldShowPagination: paginationState.shouldShowPagination,
    startResult: paginationState.startResult,
    totalResults,
  };
}

export type OpsEmailDeliveryPresentationState = ReturnType<
  typeof useOpsEmailDeliveryPresentationState
>;
