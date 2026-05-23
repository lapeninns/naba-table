import { describe, expect, it } from 'vitest';

import {
  buildAvailableRestaurantOptions,
  buildFallbackRestaurantOptions,
  canInjectDeliveryLogError,
  DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
  formatRefreshLabel,
  formatRelativeSeconds,
  getDeliveryFeedErrorMessage,
  normalizeRestaurantId,
  resolveActiveRefreshState,
  resolveDeliveryLogErrorMessage,
  resolvePaginationState,
  shouldShowEmailDeliveryEmptyGuidance,
} from '@/components/features/email-delivery/opsEmailDeliveryStateDomain';

describe('opsEmailDeliveryStateDomain', () => {
  it('normalizes delivery feed errors into operator-facing messages', () => {
    expect(getDeliveryFeedErrorMessage({ message: '' })).toBe(
      'We could not load the delivery log right now. Please try again.',
    );
    expect(getDeliveryFeedErrorMessage({ error: 'Failed to fetch' })).toBe(
      'We could not reach the delivery log service. Check your connection and try again.',
    );
    expect(getDeliveryFeedErrorMessage(new Error('Access denied'))).toBe('Access denied');
  });

  it('formats refresh labels and relative update ages', () => {
    expect(formatRefreshLabel('off')).toBe('Off');
    expect(formatRefreshLabel('30s')).toBe('30s');
    expect(formatRefreshLabel('1m')).toBe('1m');
    expect(formatRefreshLabel('5m')).toBe('5m');
    expect(formatRelativeSeconds(null, 1_000)).toBe('Waiting for first refresh…');
    expect(formatRelativeSeconds(1_000, 1_000)).toBe('Last updated just now');
    expect(formatRelativeSeconds(1_000, 2_000)).toBe('Last updated 1 second ago');
    expect(formatRelativeSeconds(1_000, 6_500)).toBe('Last updated 5 seconds ago');
  });

  it('selects an effective restaurant from parsed, active, then membership fallback', () => {
    const memberships = [{ restaurantId: 'rest-1' }, { restaurantId: 'rest-2' }];
    const membershipIds = new Set(memberships.map((membership) => membership.restaurantId));

    expect(
      normalizeRestaurantId({
        activeRestaurantId: 'rest-2',
        membershipIds,
        memberships,
        parsedRestaurantId: 'rest-1',
      }),
    ).toBe('rest-1');
    expect(
      normalizeRestaurantId({
        activeRestaurantId: 'rest-2',
        membershipIds,
        memberships,
        parsedRestaurantId: 'missing',
      }),
    ).toBe('rest-2');
    expect(
      normalizeRestaurantId({
        activeRestaurantId: null,
        membershipIds,
        memberships,
        parsedRestaurantId: null,
      }),
    ).toBe('rest-1');
  });

  it('builds available restaurant options from service rows and membership fallback rows', () => {
    const membershipIds = new Set(['rest-1', 'rest-3']);

    expect(
      buildAvailableRestaurantOptions({
        membershipIds,
        restaurants: [
          { id: 'rest-1', name: 'Old Crown', timezone: 'Europe/London' },
          { id: 'rest-2', name: 'Hidden Restaurant', timezone: 'Europe/Paris' },
          { id: 'rest-3', name: 'Queen Elizabeth', timezone: null },
        ],
      }),
    ).toEqual([
      { id: 'rest-1', name: 'Old Crown', timezone: 'Europe/London' },
      { id: 'rest-3', name: 'Queen Elizabeth', timezone: null },
    ]);

    expect(
      buildFallbackRestaurantOptions([
        { restaurantId: 'rest-1', restaurantName: 'Old Crown' },
        { restaurantId: 'rest-3', restaurantName: 'Queen Elizabeth' },
      ]),
    ).toEqual([
      { id: 'rest-1', name: 'Old Crown', timezone: null },
      { id: 'rest-3', name: 'Queen Elizabeth', timezone: null },
    ]);
  });

  it('derives active refresh state from the selected tab', () => {
    expect(
      resolveActiveRefreshState({
        activeTab: 'delivery-log',
        analyticsDataUpdatedAt: 30,
        analyticsIsFetching: false,
        feedDataUpdatedAt: 10,
        feedIsFetching: true,
        queueIsRefreshing: false,
        queueLastUpdatedAt: 20,
      }),
    ).toEqual({ activeLastUpdatedAt: 10, activeIsRefreshing: true });

    expect(
      resolveActiveRefreshState({
        activeTab: 'queue',
        analyticsDataUpdatedAt: 30,
        analyticsIsFetching: true,
        feedDataUpdatedAt: 10,
        feedIsFetching: true,
        queueIsRefreshing: false,
        queueLastUpdatedAt: 20,
      }),
    ).toEqual({ activeLastUpdatedAt: 20, activeIsRefreshing: false });

    expect(
      resolveActiveRefreshState({
        activeTab: 'analytics',
        analyticsDataUpdatedAt: 0,
        analyticsIsFetching: true,
        feedDataUpdatedAt: 10,
        feedIsFetching: false,
        queueIsRefreshing: false,
        queueLastUpdatedAt: 20,
      }),
    ).toEqual({ activeLastUpdatedAt: null, activeIsRefreshing: true });
  });

  it('derives pagination result ranges from response metadata and visible rows', () => {
    expect(
      resolvePaginationState({
        currentRowCount: 10,
        initialPageSize: 50,
        pageInfo: { page: 2, pageSize: 10, hasNext: true },
        requestedPage: 1,
        requestedPageSize: 50,
        totalResults: 25,
      }),
    ).toEqual({
      currentPage: 2,
      currentPageSize: 10,
      shouldShowPagination: true,
      hasPrevPage: true,
      hasNextPage: true,
      startResult: 11,
      endResult: 20,
    });

    expect(
      resolvePaginationState({
        currentRowCount: 0,
        initialPageSize: 50,
        pageInfo: null,
        requestedPage: 1,
        requestedPageSize: 50,
        totalResults: 0,
      }),
    ).toMatchObject({
      shouldShowPagination: false,
      hasPrevPage: false,
      hasNextPage: false,
      startResult: 0,
      endResult: 0,
    });
  });

  it('resolves stuck-loading error fallback and empty guidance visibility', () => {
    expect(
      resolveDeliveryLogErrorMessage({
        baseErrorMessage: 'Server failed',
        messageId: DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
        simulateEmailDeliveryError: true,
        stuckLoadingFallbackActive: true,
      }),
    ).toBe('Server failed');

    expect(
      resolveDeliveryLogErrorMessage({
        baseErrorMessage: null,
        messageId: DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
        simulateEmailDeliveryError: false,
        stuckLoadingFallbackActive: true,
      }),
    ).toBe(
      'The delivery log is taking longer than expected to settle after the forced error response. Retry to request the latest state again.',
    );

    expect(
      shouldShowEmailDeliveryEmptyGuidance({
        effectiveDeliveryLogErrorMessage: null,
        feedUnavailable: false,
        isFeedLoading: true,
        rowCount: 0,
        stuckLoadingFallbackActive: true,
      }),
    ).toBe(true);
    expect(
      shouldShowEmailDeliveryEmptyGuidance({
        effectiveDeliveryLogErrorMessage: 'Server failed',
        feedUnavailable: false,
        isFeedLoading: false,
        rowCount: 0,
        stuckLoadingFallbackActive: false,
      }),
    ).toBe(false);
  });

  it('limits delivery-log error injection to dev routes or non-production environments', () => {
    expect(
      canInjectDeliveryLogError({
        appEnv: 'production',
        nodeEnv: 'production',
        pathname: '/app/customers/delivery',
      }),
    ).toBe(false);
    expect(
      canInjectDeliveryLogError({
        appEnv: 'production',
        nodeEnv: 'production',
        pathname: '/app/dev/ops-email-delivery',
      }),
    ).toBe(false);
    expect(
      canInjectDeliveryLogError({
        appEnv: 'test',
        nodeEnv: 'production',
        pathname: '/app/dev/ops-email-delivery',
      }),
    ).toBe(true);
  });
});
