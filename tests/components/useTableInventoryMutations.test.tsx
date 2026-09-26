import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableInventoryMutations } from '@/components/features/tables/useTableInventoryMutations';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { HttpError } from '@/lib/http/errors';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type {
  ListTablesResult,
  TableInventory,
  TableInventoryService,
  UpdateTablePayload,
} from '@/services/ops/tables';
import type ZoneService from '@/services/ops/zones';
import type { Zone } from '@/services/ops/zones';
import type { ReactNode } from 'react';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));

const RESTAURANT_A = 'rest-a';
const RESTAURANT_B = 'rest-b';

function makeTable(overrides: Partial<TableInventory> & { id: string }): TableInventory {
  return {
    restaurantId: RESTAURANT_A,
    tableNumber: '1',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'zone-main',
    zoneName: 'Main',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
    ...overrides,
  };
}

function makeZone(overrides: Partial<Zone> & { id: string }): Zone {
  return {
    restaurantId: RESTAURANT_A,
    name: 'Main',
    sortOrder: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function tablesResult(zoneActive = true): ListTablesResult {
  return {
    tables: [
      makeTable({ id: 'table-1', tableNumber: '1', active: false, zoneActive }),
      makeTable({ id: 'table-2', tableNumber: '2', status: 'out_of_service', zoneActive }),
    ],
    summary: {
      totalTables: 2,
      totalCapacity: 8,
      availableTables: 0,
      zones: [{ id: 'zone-main', name: 'Main', active: zoneActive, sortOrder: 0 }],
      serviceCapacities: [],
    },
  };
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createTableService(overrides: Partial<TableInventoryService> = {}): TableInventoryService {
  return {
    list: vi.fn().mockResolvedValue(tablesResult()),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    timeline: vi.fn(),
    ...overrides,
  } as TableInventoryService;
}

function createZoneService(overrides: Partial<Record<keyof ZoneService, unknown>> = {}) {
  return {
    list: vi.fn().mockResolvedValue([makeZone({ id: 'zone-main' })]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  } as unknown as ZoneService;
}

const callbacks = {
  onTableSaved: vi.fn(),
  onTableNumberConflict: vi.fn(),
  onTableDeleted: vi.fn(),
  onZoneCreated: vi.fn(),
  onZoneSaved: vi.fn(),
  onZoneDeleted: vi.fn(),
};

const tablesKey = queryKeys.opsTables.list(RESTAURANT_A);
const zonesKey = queryKeys.opsTables.zones(RESTAURANT_A);

/** Renders the mutations next to live tables and zones queries, as the page does. */
function renderMutations(options: {
  queryClient: QueryClient;
  tableService: TableInventoryService;
  zoneService: ZoneService;
}) {
  const { queryClient, tableService, zoneService } = options;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{ tableInventoryService: () => tableService, zoneService: () => zoneService }}
      >
        {children}
      </OpsServicesProvider>
    </QueryClientProvider>
  );
  return renderHook(
    () => {
      useQuery({ queryKey: tablesKey, queryFn: () => tableService.list(RESTAURANT_A) });
      useQuery({ queryKey: zonesKey, queryFn: () => zoneService.list(RESTAURANT_A) });
      return useTableInventoryMutations({
        restaurantId: RESTAURANT_A,
        tablesQueryKey: tablesKey,
        zonesQueryKey: zonesKey,
        ...callbacks,
      });
    },
    { wrapper },
  );
}

/** Like `renderMutations`, but the active restaurant can be switched with `rerender`. */
function renderSwitchableMutations(options: {
  queryClient: QueryClient;
  tableService: TableInventoryService;
  zoneService: ZoneService;
}) {
  const { queryClient, tableService, zoneService } = options;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{ tableInventoryService: () => tableService, zoneService: () => zoneService }}
      >
        {children}
      </OpsServicesProvider>
    </QueryClientProvider>
  );
  return renderHook(
    ({ rid }: { rid: string }) => {
      const listKey = queryKeys.opsTables.list(rid);
      const zoneKey = queryKeys.opsTables.zones(rid);
      useQuery({ queryKey: listKey, queryFn: () => tableService.list(rid) });
      useQuery({ queryKey: zoneKey, queryFn: () => zoneService.list(rid) });
      return useTableInventoryMutations({
        restaurantId: rid,
        tablesQueryKey: listKey,
        zonesQueryKey: zoneKey,
        ...callbacks,
      });
    },
    { wrapper, initialProps: { rid: RESTAURANT_A } },
  );
}

function cachedTable(queryClient: QueryClient, id: string) {
  return queryClient.getQueryData<ListTablesResult>(tablesKey)?.tables.find((t) => t.id === id);
}

function cachedZoneActive(queryClient: QueryClient) {
  return queryClient.getQueryData<ListTablesResult>(tablesKey)?.summary?.zones[0]?.active;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useTableInventoryMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['TABLE_NUMBER_TAKEN', true],
    // A server that predates C1 codes answers a duplicate number with a bare 409.
    ['HTTP_409', true],
    ['MAINTENANCE_CONFLICT', false],
    ['STALE_WRITE', false],
  ] as const)(
    'routes a 409 %s on table save to the number field only when it is a number clash',
    async (code, isNumberConflict) => {
      const queryClient = createAppQueryClient();
      const tableService = createTableService({
        update: vi
          .fn()
          .mockRejectedValue(new HttpError({ message: 'Conflict', status: 409, code })),
      });
      const { result } = renderMutations({
        queryClient,
        tableService,
        zoneService: createZoneService(),
      });
      await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

      await act(async () => {
        await result.current.updateMutation
          .mutateAsync({ tableId: 'table-1', payload: { tableNumber: '4', capacity: 6 } })
          .catch(() => undefined);
      });

      if (isNumberConflict) {
        expect(callbacks.onTableNumberConflict).toHaveBeenCalledWith('4');
        expect(toastMocks.error).not.toHaveBeenCalled();
      } else {
        expect(callbacks.onTableNumberConflict).not.toHaveBeenCalled();
        expect(toastMocks.error).toHaveBeenCalledWith(
          'Table wasn’t saved. Your details are still here.',
          expect.objectContaining({ description: expect.anything() }),
        );
      }
    },
  );

  it("leaves another restaurant's tables cache alone when a table is saved", async () => {
    const queryClient = createAppQueryClient();
    const otherKey = queryKeys.opsTables.list(RESTAURANT_B);
    queryClient.setQueryData(otherKey, tablesResult());
    const tableService = createTableService({
      update: vi.fn().mockResolvedValue(makeTable({ id: 'table-1' })),
    });
    const { result } = renderMutations({
      queryClient,
      tableService,
      zoneService: createZoneService(),
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

    await act(async () => {
      await result.current.updateMutation.mutateAsync({
        tableId: 'table-1',
        payload: { tableNumber: '1', capacity: 6 },
      });
    });

    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
    await waitFor(() => expect(tableService.list).toHaveBeenCalledTimes(2));
  });

  it('rolls back only the failed quick fix when two run at once', async () => {
    const queryClient = createAppQueryClient();
    const first = deferred<TableInventory>();
    const second = deferred<TableInventory>();
    const tableService = createTableService({
      update: vi.fn((tableId: string, _payload: UpdateTablePayload) =>
        tableId === 'table-1' ? first.promise : second.promise,
      ),
    });
    const { result } = renderMutations({
      queryClient,
      tableService,
      zoneService: createZoneService(),
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

    act(() => {
      result.current.quickFixMutation.mutate({
        table: { id: 'table-1', tableNumber: '1' },
        patch: { active: true },
        undo: { active: false },
        message: 'Table 1 can be booked again.',
      });
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')?.active).toBe(true));
    act(() => {
      result.current.quickFixMutation.mutate({
        table: { id: 'table-2', tableNumber: '2' },
        patch: { status: 'available' },
        undo: { status: 'out_of_service' },
        message: 'Table 2 can be booked again.',
      });
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-2')?.status).toBe('available'));

    await act(async () => {
      first.reject(new HttpError({ message: 'Failed', status: 500, code: 'HTTP_500' }));
    });
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
    await flush();

    expect(cachedTable(queryClient, 'table-1')?.active).toBe(false);
    // Table 2's fix is still in flight, so its optimistic value stays.
    expect(cachedTable(queryClient, 'table-2')?.status).toBe('available');
  });

  it('reports a created zone as partly saved when renumbering fails, and refetches', async () => {
    const queryClient = createAppQueryClient();
    const created = makeZone({ id: 'zone-new', name: 'Terrace', sortOrder: 0 });
    const zoneService = createZoneService({
      create: vi.fn().mockResolvedValue(created),
      update: vi.fn().mockRejectedValue(new HttpError({ message: 'Failed', status: 500 })),
    });
    const tableService = createTableService();
    const { result } = renderMutations({ queryClient, tableService, zoneService });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());
    const listCalls = vi.mocked(tableService.list).mock.calls.length;
    const zoneListCalls = vi.mocked(zoneService.list).mock.calls.length;

    await act(async () => {
      result.current.zoneCreateMutation.mutate({
        restaurantId: RESTAURANT_A,
        name: 'Terrace',
        sortOrder: 0,
        reorder: [{ zoneId: 'zone-main', sortOrder: 1 }],
      });
    });

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
    const message = String(toastMocks.error.mock.calls[0]?.[0]);
    expect(message).toMatch(/added/i);
    expect(message).not.toMatch(/wasn’t saved/);
    // The zone exists, so the dialog closes rather than inviting a duplicate retry.
    expect(callbacks.onZoneCreated).toHaveBeenCalledWith(created);
    await waitFor(() => {
      expect(vi.mocked(tableService.list).mock.calls.length).toBeGreaterThan(listCalls);
      expect(vi.mocked(zoneService.list).mock.calls.length).toBeGreaterThan(zoneListCalls);
    });
  });

  it('reports an updated zone as partly saved when renumbering fails', async () => {
    const queryClient = createAppQueryClient();
    const saved = makeZone({ id: 'zone-main', name: 'Main room' });
    const zoneService = createZoneService({
      update: vi
        .fn()
        .mockResolvedValueOnce(saved)
        .mockRejectedValue(new HttpError({ message: 'Failed', status: 500 })),
    });
    const { result } = renderMutations({
      queryClient,
      tableService: createTableService(),
      zoneService,
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

    await act(async () => {
      result.current.zoneUpdateMutation.mutate({
        zoneId: 'zone-main',
        name: 'Main room',
        sortOrder: 1,
        reorder: [{ zoneId: 'zone-patio', sortOrder: 0 }],
      });
    });

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
    expect(String(toastMocks.error.mock.calls[0]?.[0])).toMatch(/saved/i);
    expect(String(toastMocks.error.mock.calls[0]?.[0])).not.toMatch(/wasn’t saved/);
    expect(callbacks.onZoneSaved).toHaveBeenCalledWith(saved);
  });

  it('ends a rapid off/on zone toggle in the last requested state', async () => {
    const queryClient = createAppQueryClient();
    let serverActive = true;
    const pending: Array<{ active: boolean; done: Deferred<Zone> }> = [];
    const zoneService = createZoneService({
      list: vi.fn(async () => [makeZone({ id: 'zone-main', active: serverActive })]),
      update: vi.fn((_zoneId: string, payload: { active?: boolean }) => {
        const done = deferred<Zone>();
        pending.push({ active: payload.active ?? serverActive, done });
        return done.promise;
      }),
    });
    const tableService = createTableService({
      list: vi.fn(async () => tablesResult(serverActive)),
    });
    const { result } = renderMutations({ queryClient, tableService, zoneService });
    await waitFor(() => expect(cachedZoneActive(queryClient)).toBe(true));

    act(() => {
      result.current.zoneUpdateMutation.mutate({ zoneId: 'zone-main', active: false });
    });
    act(() => {
      result.current.zoneUpdateMutation.mutate({ zoneId: 'zone-main', active: true });
    });
    await flush();
    expect(cachedZoneActive(queryClient)).toBe(true);

    // The server applies whichever request it answers; answer the newest one first.
    for (let step = 0; step < 4 && pending.length > 0; step += 1) {
      const next = pending.pop();
      if (!next) break;
      serverActive = next.active;
      await act(async () => {
        next.done.resolve(makeZone({ id: 'zone-main', active: next.active }));
      });
      await flush();
    }

    await waitFor(() => expect(result.current.zoneUpdateMutation.isPending).toBe(false));
    await flush();
    expect(serverActive).toBe(true);
    await waitFor(() => expect(cachedZoneActive(queryClient)).toBe(true));
  });

  it('rolls back and refetches the restaurant a quick fix started on after a switch', async () => {
    const queryClient = createAppQueryClient();
    const save = deferred<TableInventory>();
    const tableService = createTableService({ update: vi.fn(() => save.promise) });
    const { result, rerender } = renderSwitchableMutations({
      queryClient,
      tableService,
      zoneService: createZoneService(),
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

    act(() => {
      result.current.quickFixMutation.mutate({
        table: { id: 'table-1', tableNumber: '1' },
        patch: { active: true },
        undo: { active: false },
        message: 'Table 1 can be booked again.',
      });
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')?.active).toBe(true));
    rerender({ rid: RESTAURANT_B });

    await act(async () => {
      save.reject(new HttpError({ message: 'Failed', status: 500, code: 'HTTP_500' }));
    });
    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled());
    await flush();

    expect(cachedTable(queryClient, 'table-1')?.active).toBe(false);
    expect(queryClient.getQueryState(tablesKey)?.isInvalidated).toBe(true);
  });

  it('refetches the restaurant a table save started on after a switch', async () => {
    const queryClient = createAppQueryClient();
    const save = deferred<TableInventory>();
    const tableService = createTableService({ update: vi.fn(() => save.promise) });
    const { result, rerender } = renderSwitchableMutations({
      queryClient,
      tableService,
      zoneService: createZoneService(),
    });
    await waitFor(() => expect(cachedTable(queryClient, 'table-1')).toBeDefined());

    act(() => {
      result.current.updateMutation.mutate({
        tableId: 'table-1',
        payload: { tableNumber: '1', capacity: 6 },
      });
    });
    rerender({ rid: RESTAURANT_B });
    await waitFor(() =>
      expect(queryClient.getQueryState(queryKeys.opsTables.list(RESTAURANT_B))?.status).toBe(
        'success',
      ),
    );

    await act(async () => {
      save.resolve(makeTable({ id: 'table-1', capacity: 6 }));
    });
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalled());

    expect(queryClient.getQueryState(tablesKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.opsTables.list(RESTAURANT_B))?.isInvalidated).toBe(
      false,
    );
  });

  it('rolls a zone switch back to the saved value when two queued toggles both fail', async () => {
    const queryClient = createAppQueryClient();
    const failures: Array<Deferred<Zone>> = [];
    const zoneService = createZoneService({
      update: vi.fn(() => {
        const done = deferred<Zone>();
        failures.push(done);
        return done.promise;
      }),
    });
    // After the first load, refetches never answer, so the cache shows only what the rollback wrote.
    const tableService = createTableService({
      list: vi
        .fn()
        .mockResolvedValueOnce(tablesResult(true))
        .mockImplementation(() => new Promise<ListTablesResult>(() => undefined)),
    });
    const { result } = renderMutations({ queryClient, tableService, zoneService });
    await waitFor(() => expect(cachedZoneActive(queryClient)).toBe(true));

    act(() => {
      result.current.zoneUpdateMutation.mutate({ zoneId: 'zone-main', active: false });
    });
    act(() => {
      result.current.zoneUpdateMutation.mutate({ zoneId: 'zone-main', active: true });
    });
    await flush();

    for (let step = 0; step < 2; step += 1) {
      await waitFor(() => expect(failures.length).toBe(step + 1));
      await act(async () => {
        failures[step]?.reject(new HttpError({ message: 'Failed', status: 500 }));
      });
      await flush();
    }

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledTimes(2));
    expect(cachedZoneActive(queryClient)).toBe(true);
  });
});
