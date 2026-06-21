import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useOpsRoutePrefetch } from '@/components/features/ops-shell/useOpsRoutePrefetch';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { queryKeys } from '@/lib/query/keys';

import type { TableInventoryService } from '@/services/ops/tables';
import type { OpsMembership, OpsUser } from '@/types/ops';

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

function renderPrefetchHook(tableInventoryService: TableInventoryService) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider factories={{ tableInventoryService: () => tableInventoryService }}>
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
});
