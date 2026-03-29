'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOpsEmailDeliveryDataState } from '@/components/features/email-delivery/useOpsEmailDeliveryDataState';
import { useOpsEmailDeliveryQueryState } from '@/components/features/email-delivery/useOpsEmailDeliveryQueryState';
import { useOpsEmailDeliveryRetryState } from '@/components/features/email-delivery/useOpsEmailDeliveryRetryState';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';


import type { EmailDeliveryTab } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { OpsEmailDeliveryRange, EmailDeliveryStatus } from '@/types/emailDelivery';

const DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID = '__force_error__';
const DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS = 1500;
const EMPTY_STATUSES: EmailDeliveryStatus[] = [];

function getDeliveryFeedErrorMessage(
  error: { message?: string | null; error?: string | null } | Error,
): string {
  const message = 'message' in error ? error.message : null;
  const fallback = 'error' in error ? error.error : null;
  const raw = message?.trim() || fallback?.trim() || '';

  if (!raw) {
    return 'We could not load the delivery log right now. Please try again.';
  }

  const normalized = raw.toLowerCase();
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed')
  ) {
    return 'We could not reach the delivery log service. Check your connection and try again.';
  }

  return raw;
}

function formatRefreshLabel(option: 'off' | '30s' | '1m' | '5m'): string {
  if (option === 'off') return 'Off';
  if (option === '30s') return '30s';
  if (option === '1m') return '1m';
  return '5m';
}

function formatRelativeSeconds(lastUpdatedAt: number | null, now: number): string {
  if (!lastUpdatedAt) return 'Waiting for first refresh…';
  const diffSeconds = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (diffSeconds === 0) return 'Last updated just now';
  if (diffSeconds === 1) return 'Last updated 1 second ago';
  return `Last updated ${diffSeconds} seconds ago`;
}

function normalizeRestaurantId(
  parsedRestaurantId: string | null,
  membershipIds: Set<string>,
  activeRestaurantId: string | null,
  memberships: Array<{ restaurantId: string }>,
) {
  if (parsedRestaurantId && membershipIds.has(parsedRestaurantId)) {
    return parsedRestaurantId;
  }
  if (activeRestaurantId) return activeRestaurantId;
  return memberships[0]?.restaurantId ?? null;
}

export type OpsEmailDeliveryClientProps = {
  initialTab?: EmailDeliveryTab;
  initialRestaurantId?: string | null;
  initialRange?: OpsEmailDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: EmailDeliveryStatus[];
  initialSimulateEmailDeliveryError?: boolean;
  initialFixture?: string | null;
  initialQueueFixture?: string | null;
  initialSimulateRetryMutationError?: boolean;
  initialRecipientEmail?: string | null;
  initialMessageId?: string | null;
  initialBookingRef?: string | null;
  initialTemplateType?: string | null;
  initialEmailType?: string | null;
};

export function useOpsEmailDeliveryState({
  initialTab = 'delivery-log',
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = EMPTY_STATUSES,
  initialSimulateEmailDeliveryError = false,
  initialFixture = null,
  initialQueueFixture = null,
  initialSimulateRetryMutationError = false,
  initialRecipientEmail = null,
  initialMessageId = null,
  initialBookingRef = null,
  initialTemplateType = null,
  initialEmailType = null,
}: OpsEmailDeliveryClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { bookingService, restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );

  const queryState = useOpsEmailDeliveryQueryState({
    pathname,
    searchParams,
    effectiveRestaurantId: activeRestaurantId,
    initialTab,
    initialRestaurantId,
    initialRange,
    initialPage,
    initialPageSize,
    initialStatuses,
    initialSimulateEmailDeliveryError,
    initialFixture,
    initialQueueFixture,
    initialSimulateRetryMutationError,
    initialRecipientEmail,
    initialMessageId,
    initialBookingRef,
    initialTemplateType,
    initialEmailType,
  });
  const parsedRestaurantId = queryState.parsedRestaurantId;
  const resetToDefaults = queryState.resetToDefaults;

  const effectiveRestaurantId = useMemo(
    () =>
      normalizeRestaurantId(
        parsedRestaurantId,
        membershipIds,
        activeRestaurantId,
        memberships,
      ),
    [activeRestaurantId, membershipIds, memberships, parsedRestaurantId],
  );

  useEffect(() => {
    if (!parsedRestaurantId) return;
    if (!membershipIds.has(parsedRestaurantId)) return;
    if (parsedRestaurantId !== activeRestaurantId) {
      setActiveRestaurantId(parsedRestaurantId);
    }
  }, [activeRestaurantId, membershipIds, parsedRestaurantId, setActiveRestaurantId]);

  useEffect(() => {
    if (!effectiveRestaurantId) return;
    const currentRestaurantId = parsedRestaurantId;
    if (!currentRestaurantId || currentRestaurantId === effectiveRestaurantId) return;
    resetToDefaults(effectiveRestaurantId);
  }, [effectiveRestaurantId, parsedRestaurantId, resetToDefaults]);

  const restaurantDetails = useOpsRestaurantDetails(effectiveRestaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';
  const [availableRestaurants, setAvailableRestaurants] = useState<
    Array<{ id: string; name: string; timezone?: string | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          restaurants
            .filter((restaurant) => membershipIds.has(restaurant.id))
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              timezone: restaurant.timezone,
            })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(
          memberships.map((membership) => ({
            id: membership.restaurantId,
            name: membership.restaurantName,
            timezone: null,
          })),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const dataState = useOpsEmailDeliveryDataState({
    restaurantId: effectiveRestaurantId,
    activeTab: queryState.tab,
    range: queryState.range,
    page: queryState.page,
    pageSize: queryState.pageSize,
    refresh: queryState.refresh,
    statuses: queryState.statuses,
    simulateEmailDeliveryError: queryState.simulateEmailDeliveryError,
    fixture: queryState.fixture,
    recipientEmail: queryState.recipientEmail,
    messageId: queryState.messageId,
    bookingRef: queryState.bookingRef,
    templateType: queryState.templateType,
    emailType: queryState.emailType,
    timezone,
  });

  const retryState = useOpsEmailDeliveryRetryState({
    bookingService,
    rowByKey: dataState.rowByKey,
    refetch: dataState.feedQuery.refetch,
    simulateRetryMutationError: queryState.simulateRetryMutationError,
  });

  const [manualRefreshNonce, setManualRefreshNonce] = useState(0);
  const [queueRefreshState, setQueueRefreshState] = useState<{
    isRefreshing: boolean;
    lastUpdatedAt: number | null;
  }>({ isRefreshing: false, lastUpdatedAt: null });
  const [relativeRefreshNow, setRelativeRefreshNow] = useState(() => Date.now());
  const [stuckLoadingFallbackActive, setStuckLoadingFallbackActive] = useState(false);

  const activeLastUpdatedAt =
    queryState.tab === 'delivery-log'
      ? dataState.feedQuery.dataUpdatedAt > 0
        ? dataState.feedQuery.dataUpdatedAt
        : null
      : queryState.tab === 'queue'
        ? queueRefreshState.lastUpdatedAt
        : dataState.analyticsQuery.dataUpdatedAt > 0
          ? dataState.analyticsQuery.dataUpdatedAt
          : null;

  const activeIsRefreshing =
    queryState.tab === 'delivery-log'
      ? dataState.feedQuery.isFetching
      : queryState.tab === 'queue'
        ? queueRefreshState.isRefreshing
        : dataState.analyticsQuery.isFetching;

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
    dataState.feedQuery.response && dataState.feedQuery.response.ok
      ? dataState.feedQuery.response.pageInfo
      : null;
  const currentPage = pageInfo?.page ?? queryState.page;
  const currentPageSize = pageInfo?.pageSize ?? queryState.pageSize;
  const totalResults = dataState.summary?.total ?? 0;
  const shouldShowPagination =
    currentPage > 1 || totalResults > 0 || currentPageSize !== initialPageSize;
  const hasPrevPage = currentPage > 1;
  const hasNextPage = Boolean(pageInfo?.hasNext);
  const rawStartResult = totalResults > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;
  const hasVisibleRows = dataState.rows.length > 0 && totalResults > 0;
  const startResult = hasVisibleRows ? Math.min(rawStartResult, totalResults) : 0;
  const endResult = hasVisibleRows
    ? Math.min(totalResults, rawStartResult + dataState.rows.length - 1)
    : 0;

  const deliveryLogErrorMessage = dataState.feedQuery.apiError
    ? getDeliveryFeedErrorMessage(dataState.feedQuery.apiError)
    : dataState.feedQuery.error
      ? getDeliveryFeedErrorMessage(dataState.feedQuery.error)
      : null;

  const shouldShowStuckLoadingAlert =
    stuckLoadingFallbackActive &&
    (queryState.simulateEmailDeliveryError ||
      queryState.messageId === DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID);

  const stuckLoadingFallbackMessage = shouldShowStuckLoadingAlert
    ? 'The delivery log is taking longer than expected to settle after the forced error response. Retry to request the latest state again.'
    : 'The delivery log is taking longer than expected to settle. Try again or adjust the filters to recover the latest results.';

  const effectiveDeliveryLogErrorMessage =
    deliveryLogErrorMessage ?? (shouldShowStuckLoadingAlert ? stuckLoadingFallbackMessage : null);

  const shouldShowEmptyGuidance =
    !dataState.feedQuery.unavailable &&
    !effectiveDeliveryLogErrorMessage &&
    (!dataState.feedQuery.isLoading || stuckLoadingFallbackActive) &&
    dataState.rows.length === 0;

  const canInjectDeliveryLogError =
    pathname?.includes('/dev/') &&
    (process.env.NODE_ENV !== 'production' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
      process.env.NEXT_PUBLIC_APP_ENV === 'test');

  const handleRestaurantChange = useCallback(
    (nextRestaurantId: string) => {
      if (!membershipIds.has(nextRestaurantId)) return;
      setActiveRestaurantId(nextRestaurantId);
      resetToDefaults(nextRestaurantId);
    },
    [membershipIds, resetToDefaults, setActiveRestaurantId],
  );

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
    pathname,
    memberships,
    availableRestaurants,
    effectiveRestaurantId,
    timezone,
    restaurantDetails,
    queryState,
    dataState,
    retryState,
    queueRefreshState,
    setQueueRefreshState,
    manualRefreshNonce,
    manualRefreshBusy,
    autoRefreshActive,
    activeLastUpdatedAt,
    refreshIndicatorText: autoRefreshActive
      ? formatRelativeSeconds(activeLastUpdatedAt, relativeRefreshNow)
      : null,
    formatRefreshLabel,
    handleRestaurantChange,
    handlePrev,
    handleNext,
    pageInfo,
    currentPage,
    currentPageSize,
    totalResults,
    shouldShowPagination,
    hasPrevPage,
    hasNextPage,
    startResult,
    endResult,
    effectiveDeliveryLogErrorMessage,
    shouldShowEmptyGuidance,
    canInjectDeliveryLogError,
    handleManualRefresh,
    analyticsErrorMessage,
    DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
  };
}
