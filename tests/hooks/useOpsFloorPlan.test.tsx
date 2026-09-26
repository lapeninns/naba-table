import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpsFloorPlan } from '@src/hooks/ops/useOpsFloorPlan';

import type { ListTablesResult } from '@/services/ops/tables';

const tableService = vi.hoisted(() => ({ list: vi.fn() }));
const dashboardData = vi.hoisted(() => vi.fn());
const tableTimeline = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/ops-services', () => ({
  useTableInventoryService: () => tableService,
}));
vi.mock('@/hooks/ops/useOpsDashboardData', () => ({ useOpsDashboardData: dashboardData }));
vi.mock('@/hooks/ops/useOpsTableTimeline', () => ({ useOpsTableTimeline: tableTimeline }));

const restaurantId = '11111111-1111-4111-8111-111111111111';

/** A failed booking source, as the dashboard and timeline hooks report one. */
function failedQuery() {
  return {
    data: undefined,
    isError: true,
    isFetching: false,
    dataUpdatedAt: 0,
    refetch: vi.fn(),
    realtimeHealthy: false,
    isPolling: false,
  };
}

const tables = {
  tables: [
    {
      id: 't1',
      restaurantId,
      tableNumber: 'T1',
      capacity: 4,
      minPartySize: 1,
      maxPartySize: null,
      section: null,
      category: 'dining',
      seatingType: 'standard',
      mobility: 'movable',
      zoneId: 'z1',
      zoneName: 'Main',
      zoneActive: true,
      active: true,
      status: 'available',
      position: null,
      notes: null,
    },
  ],
  summary: null,
} as unknown as ListTablesResult;

beforeEach(() => {
  tableService.list.mockReset().mockResolvedValue(tables);
  dashboardData.mockReset().mockReturnValue(failedQuery());
  tableTimeline.mockReset().mockReturnValue(failedQuery());
});

describe('useOpsFloorPlan', () => {
  it('fails the service plan when bookings cannot load', async () => {
    const { result } = renderHook(() => useOpsFloorPlan({ restaurantId, date: null }), {
      wrapper: createQueryWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.failedSources).toEqual(['bookings', 'timeline']);
  });

  it('loads the floor layout from tables alone and never asks for bookings', async () => {
    const { result } = renderHook(
      () => useOpsFloorPlan({ restaurantId, date: null, scope: 'layout' }),
      { wrapper: createQueryWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.snapshot?.tables.map((t) => t.id)).toEqual(['t1']);
    expect(result.current.snapshot?.bookings).toEqual([]);
    expect(dashboardData).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(tableTimeline).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
});
