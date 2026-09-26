import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import { useOpsFloorPlanLayoutSave } from '@src/hooks/ops/useOpsFloorPlanLayout';

import type { ListTablesResult } from '@/services/ops/tables';

const tableService = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('@/contexts/ops-services', () => ({
  useTableInventoryService: () => tableService,
}));

const restaurantId = 'rest-1';
const listKey = queryKeys.opsTables.list(restaurantId);

function seeded() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData<ListTablesResult>(listKey, {
    tables: [
      { id: 'A', position: { x: 100, y: 100, rotation: 0 } },
      { id: 'B', position: null },
      { id: 'C', position: { x: 300, y: 100, rotation: 0 } },
    ],
    summary: null,
  } as unknown as ListTablesResult);
  const hook = renderHook(() => useOpsFloorPlanLayoutSave(restaurantId), {
    wrapper: createQueryWrapper(queryClient),
  });
  return { queryClient, hook };
}

function positions(queryClient: ReturnType<typeof createTestQueryClient>) {
  const data = queryClient.getQueryData<ListTablesResult>(listKey);
  return Object.fromEntries((data?.tables ?? []).map((t) => [t.id, t.position]));
}

beforeEach(() => tableService.update.mockReset());

describe('useOpsFloorPlanLayoutSave', () => {
  it('saves rounded positions and updates the shared tables cache', async () => {
    tableService.update.mockResolvedValue({});
    const { queryClient, hook } = seeded();

    let result: Awaited<ReturnType<typeof hook.result.current.mutateAsync>> | undefined;
    await act(async () => {
      result = await hook.result.current.mutateAsync([
        { tableId: 'A', position: { x: 120.4, y: 99.6, rotation: 15 } },
        { tableId: 'B', position: { x: 200, y: 180, rotation: 0 } },
      ]);
    });

    expect(result).toEqual({ saved: expect.arrayContaining(['A', 'B']), failed: [] });
    expect(tableService.update).toHaveBeenCalledWith('A', {
      position: { x: 120, y: 100, rotation: 15 },
    });
    expect(positions(queryClient)).toMatchObject({
      A: { x: 120, y: 100, rotation: 15 },
      B: { x: 200, y: 180, rotation: 0 },
    });
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it('reports per-table failures and reverts only those tables', async () => {
    tableService.update.mockImplementation(async (tableId: string) => {
      if (tableId === 'C') throw new HttpError({ message: 'nope', status: 403 });
      return {};
    });
    const { queryClient, hook } = seeded();

    let result: Awaited<ReturnType<typeof hook.result.current.mutateAsync>> | undefined;
    await act(async () => {
      result = await hook.result.current.mutateAsync([
        { tableId: 'A', position: { x: 150, y: 150, rotation: 0 } },
        { tableId: 'C', position: { x: 400, y: 200, rotation: 0 } },
      ]);
    });

    expect(result).toEqual({
      saved: ['A'],
      failed: [{ tableId: 'C', message: 'Only managers can change the layout.' }],
    });
    expect(positions(queryClient)).toMatchObject({
      A: { x: 150, y: 150, rotation: 0 },
      C: { x: 300, y: 100, rotation: 0 },
    });
  });

  it('limits concurrent requests', async () => {
    let inFlight = 0;
    let peak = 0;
    tableService.update.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {};
    });
    const { hook } = seeded();
    const changes = Array.from({ length: 10 }, (_, i) => ({
      tableId: `T${i}`,
      position: { x: i * 10, y: 100, rotation: 0 },
    }));

    await act(async () => {
      await hook.result.current.mutateAsync(changes);
    });

    expect(tableService.update).toHaveBeenCalledTimes(10);
    expect(peak).toBeLessThanOrEqual(4);
  });
});
