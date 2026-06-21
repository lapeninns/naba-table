import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBookings } from '@/hooks/useBookings';
import { useOpsCustomers } from '@/hooks/useOpsCustomers';
import { fetchJson } from '@/lib/http/fetchJson';
import { shouldPersistQuery } from '@/lib/query/persist';

import type { Query, QueryClient } from '@tanstack/react-query';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

const customerListMock = vi.fn();

vi.mock('@/contexts/ops-services', () => ({
  useCustomerService: () => ({ list: customerListMock }),
}));

function findQuery(queryClient: QueryClient, firstKey: string): Query {
  const match = queryClient
    .getQueryCache()
    .getAll()
    .find((query) => Array.isArray(query.queryKey) && query.queryKey[0] === firstKey);
  if (!match) {
    throw new Error(`Expected a cached query starting with "${firstKey}"`);
  }
  return match;
}

describe('PII-bearing query caches are marked non-persistent', () => {
  beforeEach(() => {
    vi.mocked(fetchJson).mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false },
    } as never);
    customerListMock.mockResolvedValue({
      items: [],
      pageInfo: { page: 1, pageSize: 50, total: 0, hasNext: false },
    });
  });

  afterEach(() => {
    customerListMock.mockReset();
  });

  it('useBookings tags its query with meta.persist=false and is excluded from persistence', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useBookings({ page: 1, pageSize: 10 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = findQuery(queryClient, 'bookings');
    expect(query.meta?.persist).toBe(false);
    expect(shouldPersistQuery(query)).toBe(false);
  });

  it('useOpsCustomers tags its query with meta.persist=false and is excluded from persistence', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(
      () => useOpsCustomers({ restaurantId: 'rest-1', pageSize: 50 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = findQuery(queryClient, 'ops');
    expect(query.meta?.persist).toBe(false);
    expect(shouldPersistQuery(query)).toBe(false);
  });
});
