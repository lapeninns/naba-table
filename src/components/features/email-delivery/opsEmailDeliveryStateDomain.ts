import type {
  EmailDeliveryTab,
  OpsEmailDeliveryRefreshOption,
} from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { OpsEmailDeliveryFeedResponse } from '@/types/emailDelivery';

export const DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID = '__force_error__';
export const DELIVERY_LOG_STUCK_LOADING_FALLBACK_MS = 1500;

export type OpsEmailDeliveryErrorLike = {
  message?: string | null;
  error?: string | null;
};

export type OpsEmailDeliveryMembershipIdentity = {
  restaurantId: string;
};

export type OpsEmailDeliveryMembershipOptionSource = OpsEmailDeliveryMembershipIdentity & {
  restaurantName: string;
};

export type OpsEmailDeliveryRestaurantOption = {
  id: string;
  name: string;
  timezone?: string | null;
};

export type OpsEmailDeliveryRestaurantOptionSource = OpsEmailDeliveryRestaurantOption;

export type OpsEmailDeliveryActiveRefreshState = {
  activeLastUpdatedAt: number | null;
  activeIsRefreshing: boolean;
};

export type OpsEmailDeliveryPaginationState = {
  currentPage: number;
  currentPageSize: number;
  shouldShowPagination: boolean;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  startResult: number;
  endResult: number;
};

export type OpsEmailDeliveryPageInfo = Extract<
  OpsEmailDeliveryFeedResponse,
  { ok: true }
>['pageInfo'];

export function getDeliveryFeedErrorMessage(error: OpsEmailDeliveryErrorLike | Error): string {
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

export function formatRefreshLabel(option: OpsEmailDeliveryRefreshOption): string {
  if (option === 'off') return 'Off';
  if (option === '30s') return '30s';
  if (option === '1m') return '1m';
  return '5m';
}

export function formatRelativeSeconds(lastUpdatedAt: number | null, now: number): string {
  if (!lastUpdatedAt) return 'Waiting for first refresh…';
  const diffSeconds = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  if (diffSeconds === 0) return 'Last updated just now';
  if (diffSeconds === 1) return 'Last updated 1 second ago';
  return `Last updated ${diffSeconds} seconds ago`;
}

export function normalizeRestaurantId({
  activeRestaurantId,
  membershipIds,
  memberships,
  parsedRestaurantId,
}: {
  activeRestaurantId: string | null;
  membershipIds: Set<string>;
  memberships: OpsEmailDeliveryMembershipIdentity[];
  parsedRestaurantId: string | null;
}): string | null {
  if (parsedRestaurantId && membershipIds.has(parsedRestaurantId)) {
    return parsedRestaurantId;
  }
  if (activeRestaurantId) return activeRestaurantId;
  return memberships[0]?.restaurantId ?? null;
}

export function buildAvailableRestaurantOptions({
  membershipIds,
  restaurants,
}: {
  membershipIds: Set<string>;
  restaurants: OpsEmailDeliveryRestaurantOptionSource[];
}): OpsEmailDeliveryRestaurantOption[] {
  return restaurants
    .filter((restaurant) => membershipIds.has(restaurant.id))
    .map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      timezone: restaurant.timezone,
    }));
}

export function buildFallbackRestaurantOptions(
  memberships: OpsEmailDeliveryMembershipOptionSource[],
): OpsEmailDeliveryRestaurantOption[] {
  return memberships.map((membership) => ({
    id: membership.restaurantId,
    name: membership.restaurantName,
    timezone: null,
  }));
}

export function resolveActiveRefreshState({
  activeTab,
  analyticsDataUpdatedAt,
  analyticsIsFetching,
  feedDataUpdatedAt,
  feedIsFetching,
  queueLastUpdatedAt,
  queueIsRefreshing,
}: {
  activeTab: EmailDeliveryTab;
  analyticsDataUpdatedAt: number;
  analyticsIsFetching: boolean;
  feedDataUpdatedAt: number;
  feedIsFetching: boolean;
  queueLastUpdatedAt: number | null;
  queueIsRefreshing: boolean;
}): OpsEmailDeliveryActiveRefreshState {
  if (activeTab === 'delivery-log') {
    return {
      activeLastUpdatedAt: feedDataUpdatedAt > 0 ? feedDataUpdatedAt : null,
      activeIsRefreshing: feedIsFetching,
    };
  }

  if (activeTab === 'queue') {
    return {
      activeLastUpdatedAt: queueLastUpdatedAt,
      activeIsRefreshing: queueIsRefreshing,
    };
  }

  return {
    activeLastUpdatedAt: analyticsDataUpdatedAt > 0 ? analyticsDataUpdatedAt : null,
    activeIsRefreshing: analyticsIsFetching,
  };
}

export function resolvePaginationState({
  currentRowCount,
  initialPageSize,
  pageInfo,
  requestedPage,
  requestedPageSize,
  totalResults,
}: {
  currentRowCount: number;
  initialPageSize: number;
  pageInfo: OpsEmailDeliveryPageInfo | null;
  requestedPage: number;
  requestedPageSize: number;
  totalResults: number;
}): OpsEmailDeliveryPaginationState {
  const currentPage = pageInfo?.page ?? requestedPage;
  const currentPageSize = pageInfo?.pageSize ?? requestedPageSize;
  const shouldShowPagination =
    currentPage > 1 || totalResults > 0 || currentPageSize !== initialPageSize;
  const hasVisibleRows = currentRowCount > 0 && totalResults > 0;
  const rawStartResult = totalResults > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;

  return {
    currentPage,
    currentPageSize,
    shouldShowPagination,
    hasPrevPage: currentPage > 1,
    hasNextPage: Boolean(pageInfo?.hasNext),
    startResult: hasVisibleRows ? Math.min(rawStartResult, totalResults) : 0,
    endResult: hasVisibleRows ? Math.min(totalResults, rawStartResult + currentRowCount - 1) : 0,
  };
}

export function resolveDeliveryLogErrorMessage({
  baseErrorMessage,
  messageId,
  simulateEmailDeliveryError,
  stuckLoadingFallbackActive,
}: {
  baseErrorMessage: string | null;
  messageId: string | null;
  simulateEmailDeliveryError: boolean;
  stuckLoadingFallbackActive: boolean;
}): string | null {
  if (baseErrorMessage) return baseErrorMessage;
  if (
    !stuckLoadingFallbackActive ||
    (!simulateEmailDeliveryError && messageId !== DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID)
  ) {
    return null;
  }
  return 'The delivery log is taking longer than expected to settle after the forced error response. Retry to request the latest state again.';
}

export function shouldShowEmailDeliveryEmptyGuidance({
  feedUnavailable,
  isFeedLoading,
  rowCount,
  stuckLoadingFallbackActive,
  effectiveDeliveryLogErrorMessage,
}: {
  feedUnavailable: boolean;
  isFeedLoading: boolean;
  rowCount: number;
  stuckLoadingFallbackActive: boolean;
  effectiveDeliveryLogErrorMessage: string | null;
}): boolean {
  return (
    !feedUnavailable &&
    !effectiveDeliveryLogErrorMessage &&
    (!isFeedLoading || stuckLoadingFallbackActive) &&
    rowCount === 0
  );
}

export function canInjectDeliveryLogError({
  appEnv,
  nodeEnv,
  pathname,
}: {
  appEnv: string | undefined;
  nodeEnv: string | undefined;
  pathname: string | null;
}): boolean {
  return (
    Boolean(pathname?.includes('/dev/')) &&
    (nodeEnv !== 'production' || appEnv === 'development' || appEnv === 'test')
  );
}
