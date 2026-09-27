import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTableInventoryDataState } from '@/components/features/tables/useTableInventoryDataState';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';

import type { ListTablesResult, TableInventoryService } from '@/services/ops/tables';
import type { ReactNode } from 'react';

const LOADED: ListTablesResult = {
  tables: [],
  summary: {
    totalTables: 0,
    totalCapacity: 0,
    availableTables: 0,
    zones: [{ id: 'zone-main', name: 'Main', active: true, sortOrder: 0 }],
    serviceCapacities: [],
  },
};

function renderDataState(list: TableInventoryService['list']) {
  const service = {
    list,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    timeline: vi.fn(),
  } as TableInventoryService;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider factories={{ tableInventoryService: () => service }}>
        {children}
      </OpsServicesProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useTableInventoryDataState('rest-1'), { wrapper });
}

describe('useTableInventoryDataState errors', () => {
  it('blocks with `error` only when nothing has loaded', async () => {
    const failure = new HttpError({ message: 'down', status: 503, code: 'HTTP_503' });
    const { result } = renderDataState(vi.fn().mockRejectedValue(failure));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
    expect(result.current.refreshError).toBeNull();
  });

  it('keeps loaded tables and reports a failed refetch as `refreshError`', async () => {
    const failure = new HttpError({ message: 'down', status: 503, code: 'HTTP_503' });
    const list = vi.fn().mockResolvedValueOnce(LOADED).mockRejectedValueOnce(failure);
    const { result } = renderDataState(list);

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.refreshError).toBe(failure));
    expect(result.current.error).toBeNull();
    expect(result.current.isError).toBe(false);
    expect(result.current.zones.map((zone) => zone.name)).toEqual(['Main']);
  });
});
