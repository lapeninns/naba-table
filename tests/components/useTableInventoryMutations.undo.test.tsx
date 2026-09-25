import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableInventoryMutations } from '@/components/features/tables/useTableInventoryMutations';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type {
  ListTablesResult,
  TableInventory,
  TableInventoryService,
} from '@/services/ops/tables';
import type ZoneService from '@/services/ops/zones';
import type { Zone } from '@/services/ops/zones';
import type { ReactNode } from 'react';

type ToastAction = { label: string; onClick: () => void };
type ShownToast = { id: number; message: string; action?: ToastAction; dismissed: boolean };

/** A tiny stand-in for sonner's toaster: remembers each toast and whether it was dismissed. */
const toaster = vi.hoisted(() => {
  const shown: ShownToast[] = [];
  return {
    shown,
    success: vi.fn((message: string, options?: { action?: ToastAction }) => {
      const id = shown.length + 1;
      shown.push({ id, message, action: options?.action, dismissed: false });
      return id;
    }),
    error: vi.fn(() => 0),
    dismiss: vi.fn((id?: number | string) => {
      for (const item of shown) {
        if (id === undefined || item.id === id) item.dismissed = true;
      }
      return id ?? 0;
    }),
  };
});
vi.mock('sonner', () => ({
  toast: { success: toaster.success, error: toaster.error, dismiss: toaster.dismiss },
}));

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
    active: false,
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

function tablesResult(): ListTablesResult {
  return {
    tables: [makeTable({ id: 'table-1' })],
    summary: {
      totalTables: 1,
      totalCapacity: 4,
      availableTables: 0,
      zones: [{ id: 'zone-main', name: 'Main', active: true, sortOrder: 0 }],
      serviceCapacities: [],
    },
  };
}

function createTableService(update: TableInventoryService['update']): TableInventoryService {
  return {
    list: vi.fn().mockResolvedValue(tablesResult()),
    create: vi.fn(),
    update: vi.fn(update),
    remove: vi.fn(),
    timeline: vi.fn(),
  } as TableInventoryService;
}

function createZoneService(update: ZoneService['update']) {
  return {
    list: vi.fn().mockResolvedValue([makeZone({ id: 'zone-main' })]),
    create: vi.fn(),
    update: vi.fn(update),
    remove: vi.fn(),
  } as unknown as ZoneService;
}

/** Renders the mutations as the page does; `rerender` switches the restaurant in place. */
function renderSwitchable(tableService: TableInventoryService, zoneService: ZoneService) {
  const queryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{ tableInventoryService: () => tableService, zoneService: () => zoneService }}
      >
        {children}
      </OpsServicesProvider>
    </QueryClientProvider>
  );
  const rendered = renderHook(
    ({ rid }: { rid: string }) => {
      const listKey = queryKeys.opsTables.list(rid);
      const zoneKey = queryKeys.opsTables.zones(rid);
      useQuery({ queryKey: listKey, queryFn: () => tableService.list(rid) });
      useQuery({ queryKey: zoneKey, queryFn: () => zoneService.list(rid) });
      return useTableInventoryMutations({
        restaurantId: rid,
        tablesQueryKey: listKey,
        zonesQueryKey: zoneKey,
        onTableSaved: vi.fn(),
        onTableNumberConflict: vi.fn(),
        onTableDeleted: vi.fn(),
        onZoneCreated: vi.fn(),
        onZoneSaved: vi.fn(),
        onZoneDeleted: vi.fn(),
      });
    },
    { wrapper, initialProps: { rid: RESTAURANT_A } },
  );
  return { ...rendered, queryClient };
}

async function waitForRestaurant(queryClient: QueryClient, restaurantId: string) {
  await waitFor(() =>
    expect(queryClient.getQueryState(queryKeys.opsTables.list(restaurantId))?.status).toBe(
      'success',
    ),
  );
}

/** How often a restaurant's tables were fetched; an Undo run against it refetches them. */
function tablesFetchesFor(tableService: TableInventoryService, restaurantId: string) {
  return vi.mocked(tableService.list).mock.calls.filter(([rid]) => rid === restaurantId).length;
}

/** Clicks Undo on every toast a person could still see. */
async function clickEveryVisibleUndo() {
  await act(async () => {
    for (const item of toaster.shown) {
      if (!item.dismissed) item.action?.onClick();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const QUICK_FIX = {
  table: { id: 'table-1', tableNumber: '1' },
  patch: { active: true },
  undo: { active: false },
  message: 'Table 1 can be booked again.',
} as const;

describe('useTableInventoryMutations undo toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toaster.shown.length = 0;
  });

  it("never runs a quick fix's Undo against the restaurant switched to", async () => {
    const tableService = createTableService(async () => makeTable({ id: 'table-1', active: true }));
    const { result, rerender, queryClient } = renderSwitchable(
      tableService,
      createZoneService(vi.fn()),
    );
    await waitForRestaurant(queryClient, RESTAURANT_A);

    await act(async () => {
      await result.current.quickFixMutation.mutateAsync(QUICK_FIX);
    });
    expect(toaster.shown[0]?.action?.label).toBe('Undo');

    rerender({ rid: RESTAURANT_B });
    await waitForRestaurant(queryClient, RESTAURANT_B);
    await clickEveryVisibleUndo();

    expect(tableService.update).toHaveBeenCalledTimes(1);
    expect(tablesFetchesFor(tableService, RESTAURANT_B)).toBe(1);
    expect(toaster.shown[0]?.dismissed).toBe(true);
  });

  it("never runs a zone toggle's Undo against the restaurant switched to", async () => {
    const zoneService = createZoneService(async (zoneId) =>
      makeZone({ id: zoneId, active: false }),
    );
    const tableService = createTableService(vi.fn());
    const { result, rerender, queryClient } = renderSwitchable(tableService, zoneService);
    await waitForRestaurant(queryClient, RESTAURANT_A);

    await act(async () => {
      await result.current.zoneUpdateMutation.mutateAsync({
        zoneId: 'zone-main',
        active: false,
        zoneName: 'Main',
      });
    });
    expect(toaster.shown[0]?.action?.label).toBe('Undo');

    rerender({ rid: RESTAURANT_B });
    await waitForRestaurant(queryClient, RESTAURANT_B);
    await clickEveryVisibleUndo();

    expect(zoneService.update).toHaveBeenCalledTimes(1);
    expect(tablesFetchesFor(tableService, RESTAURANT_B)).toBe(1);
    expect(toaster.shown[0]?.dismissed).toBe(true);
  });

  it('offers no Undo for a quick fix that finishes after the switch', async () => {
    let finish: (table: TableInventory) => void = () => undefined;
    const tableService = createTableService(
      () =>
        new Promise<TableInventory>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender, queryClient } = renderSwitchable(
      tableService,
      createZoneService(vi.fn()),
    );
    await waitForRestaurant(queryClient, RESTAURANT_A);

    act(() => {
      result.current.quickFixMutation.mutate(QUICK_FIX);
    });
    await waitFor(() => expect(tableService.update).toHaveBeenCalledTimes(1));
    rerender({ rid: RESTAURANT_B });
    await waitForRestaurant(queryClient, RESTAURANT_B);
    await act(async () => {
      finish(makeTable({ id: 'table-1', active: true }));
    });
    await waitFor(() => expect(toaster.success).toHaveBeenCalled());
    await clickEveryVisibleUndo();

    expect(toaster.shown[0]?.message).toBe('Table 1 can be booked again.');
    expect(toaster.shown[0]?.action).toBeUndefined();
    expect(tableService.update).toHaveBeenCalledTimes(1);
  });

  it('dismisses Undo toasts when the page unmounts', async () => {
    const tableService = createTableService(async () => makeTable({ id: 'table-1', active: true }));
    const { result, unmount, queryClient } = renderSwitchable(
      tableService,
      createZoneService(vi.fn()),
    );
    await waitForRestaurant(queryClient, RESTAURANT_A);

    await act(async () => {
      await result.current.quickFixMutation.mutateAsync(QUICK_FIX);
    });
    unmount();
    await clickEveryVisibleUndo();

    expect(tableService.update).toHaveBeenCalledTimes(1);
    expect(toaster.shown[0]?.dismissed).toBe(true);
  });
});
