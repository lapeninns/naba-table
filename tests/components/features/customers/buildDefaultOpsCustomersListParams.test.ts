import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CUSTOMERS_FILTER_STATE,
  INFINITE_PAGE_SIZE,
  buildDefaultOpsCustomersListParams,
} from '@/components/features/customers/opsCustomersTypes';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';
import { queryKeys } from '@/lib/query/keys';

import type { OpsCustomersPage } from '@/types/ops';

const RESTAURANT_ID = 'restaurant-1';

vi.mock('@/contexts/ops-services', () => ({
  useCustomerService: () => ({
    list: vi.fn(async () =>
      ({
        items: [],
        pageInfo: { page: 1, pageSize: INFINITE_PAGE_SIZE, total: 0, hasNext: false },
        summary: null,
      }) as unknown as OpsCustomersPage,
    ),
  }),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return { client, Wrapper };
}

describe('buildDefaultOpsCustomersListParams', () => {
  it('mirrors the default filter-state shape', () => {
    const params = buildDefaultOpsCustomersListParams(RESTAURANT_ID);

    expect(params).toEqual({
      restaurantId: RESTAURANT_ID,
      pageSize: INFINITE_PAGE_SIZE,
      sort: DEFAULT_CUSTOMERS_FILTER_STATE.sort,
      sortBy: DEFAULT_CUSTOMERS_FILTER_STATE.sortBy,
      marketingOptIn: DEFAULT_CUSTOMERS_FILTER_STATE.marketingOptIn,
      lastVisit: DEFAULT_CUSTOMERS_FILTER_STATE.lastVisit,
      minBookings: DEFAULT_CUSTOMERS_FILTER_STATE.minBookings,
    });

    // No `search` key emitted for the default landing.
    expect(params).not.toHaveProperty('search');
  });

  it('produces the same query key the live useOpsCustomers hook does for default landing filters', async () => {
    const { client, Wrapper } = createWrapper();

    const liveFilters = {
      restaurantId: RESTAURANT_ID,
      pageSize: INFINITE_PAGE_SIZE,
      sort: DEFAULT_CUSTOMERS_FILTER_STATE.sort,
      sortBy: DEFAULT_CUSTOMERS_FILTER_STATE.sortBy,
      // No search supplied → matches default landing.
      marketingOptIn: DEFAULT_CUSTOMERS_FILTER_STATE.marketingOptIn,
      lastVisit: DEFAULT_CUSTOMERS_FILTER_STATE.lastVisit,
      minBookings: DEFAULT_CUSTOMERS_FILTER_STATE.minBookings,
    };

    const { result } = renderHook(() => useOpsCustomers(liveFilters), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const liveCacheEntries = client.getQueryCache().findAll({
      queryKey: ['ops', 'customers', 'list'],
    });
    expect(liveCacheEntries).toHaveLength(1);

    const prefetchKey = queryKeys.opsCustomers.list(
      buildDefaultOpsCustomersListParams(RESTAURANT_ID),
    );

    // Defensive: react-query hashes keys with sorted JSON, so the order of
    // params shouldn't matter, but assert hash equality to lock that in.
    expect(client.getQueryCache().find({ queryKey: prefetchKey })).toBe(liveCacheEntries[0]);
  });
});
