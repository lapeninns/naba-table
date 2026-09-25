import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildDefaultOpsCustomersListParams } from '@/components/features/customers/opsCustomersTypes';
import { useOpsRoutePrefetch } from '@/components/features/ops-shell/useOpsRoutePrefetch';
import { useTableInventoryDataState } from '@/components/features/tables/useTableInventoryDataState';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import type { CustomerService } from '@/services/ops/customers';
import type { TableInventoryService } from '@/services/ops/tables';
import type { OpsCustomersPage, OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const memberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    role: 'owner',
    createdAt: null,
  },
];

function createTableInventoryService(): TableInventoryService {
  return {
    list: vi.fn().mockResolvedValue({
      tables: [],
      summary: {
        totalTables: 0,
        totalCapacity: 0,
        availableTables: 0,
        zones: [],
        serviceCapacities: [],
      },
    }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    timeline: vi.fn(),
  };
}

const EMPTY_CUSTOMERS_PAGE: OpsCustomersPage = {
  items: [],
  pageInfo: { page: 1, pageSize: 50, total: 0, hasNext: false },
};

function createCustomerService(): CustomerService {
  return { list: vi.fn().mockResolvedValue(EMPTY_CUSTOMERS_PAGE) };
}

function renderPrefetchHook(
  tableInventoryService: TableInventoryService,
  customerService: CustomerService = createCustomerService(),
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  const factories = {
    tableInventoryService: () => tableInventoryService,
    customerService: () => customerService,
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider factories={factories}>
        <OpsSessionProvider
          user={user}
          memberships={memberships}
          initialRestaurantId={memberships[0].restaurantId}
        >
          {children}
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>
  );

  return {
    queryClient,
    ...renderHook(() => useOpsRoutePrefetch(), { wrapper }),
  };
}

describe('useOpsRoutePrefetch', () => {
  it('prefetches the tables list cache consumed by the tables route', async () => {
    const tableInventoryService = createTableInventoryService();
    const { queryClient, result } = renderPrefetchHook(tableInventoryService);

    act(() => {
      result.current('/app/settings/restaurant/tables');
    });

    await waitFor(() => {
      expect(tableInventoryService.list).toHaveBeenCalledWith('rest-1');
    });

    expect(tableInventoryService.timeline).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.opsTables.list('rest-1'))).toEqual({
      tables: [],
      summary: {
        totalTables: 0,
        totalCapacity: 0,
        availableTables: 0,
        zones: [],
        serviceCapacities: [],
      },
    });
  });

  it('issues no service call when the hovered route data is still fresh', async () => {
    const tableInventoryService = createTableInventoryService();
    const { queryClient, result } = renderPrefetchHook(tableInventoryService);
    queryClient.setQueryData(queryKeys.opsTables.list('rest-1'), {
      tables: [],
      summary: null,
    });

    act(() => {
      result.current('/app/settings/restaurant/tables');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(tableInventoryService.list).not.toHaveBeenCalled();
  });

  it('refetches exactly once when the hovered route data is stale', async () => {
    const tableInventoryService = createTableInventoryService();
    const { queryClient, result } = renderPrefetchHook(tableInventoryService);
    queryClient.setQueryData(
      queryKeys.opsTables.list('rest-1'),
      { tables: [], summary: null },
      { updatedAt: Date.now() - OPS_SETTINGS_STALE_TIME.tables - 1 },
    );

    act(() => {
      result.current('/app/settings/restaurant/tables');
    });

    await waitFor(() => {
      expect(tableInventoryService.list).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps infinite-query prefetch fresh-aware for the customers route', async () => {
    const customerService = createCustomerService();
    const { queryClient, result } = renderPrefetchHook(
      createTableInventoryService(),
      customerService,
    );
    const customersKey = queryKeys.opsCustomers.list(buildDefaultOpsCustomersListParams('rest-1'));
    queryClient.setQueryData(customersKey, {
      pages: [EMPTY_CUSTOMERS_PAGE],
      pageParams: [1],
    });

    act(() => {
      result.current('/app/customers');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(customerService.list).not.toHaveBeenCalled();

    queryClient.setQueryData(
      customersKey,
      { pages: [EMPTY_CUSTOMERS_PAGE], pageParams: [1] },
      { updatedAt: Date.now() - 30_001 },
    );
    act(() => {
      result.current('/app/customers');
    });

    await waitFor(() => {
      expect(customerService.list).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useTableInventoryDataState zones fallback', () => {
  it('uses the shared settings staleTime for the zones query', () => {
    const tableInventoryService = createTableInventoryService();
    // Keep the tables list loading so the zones fallback stays disabled and makes no request.
    vi.mocked(tableInventoryService.list).mockReturnValue(new Promise(() => undefined));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });
    const factories = { tableInventoryService: () => tableInventoryService };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <OpsServicesProvider factories={factories}>{children}</OpsServicesProvider>
      </QueryClientProvider>
    );

    renderHook(() => useTableInventoryDataState('rest-1'), { wrapper });

    const zonesQuery = queryClient
      .getQueryCache()
      .find({ queryKey: queryKeys.opsTables.zones('rest-1'), exact: true });
    expect(zonesQuery?.observers[0]?.options.staleTime).toBe(OPS_SETTINGS_STALE_TIME.zones);
  });
});
