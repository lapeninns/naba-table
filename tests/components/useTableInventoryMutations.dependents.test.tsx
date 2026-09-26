import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTableInventoryMutations } from '@/components/features/tables/useTableInventoryMutations';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { createAppQueryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';

import type { ListTablesResult, TableInventory, TableInventoryService } from '@/services/ops/tables';
import type ZoneService from '@/services/ops/zones';
import type { QueryKey } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() } }));

const RESTAURANT_A = 'rest-a';
const RESTAURANT_B = 'rest-b';

const table: TableInventory = {
  id: 'table-1',
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
};

const tablesKey = queryKeys.opsTables.list(RESTAURANT_A);
const zonesKey = queryKeys.opsTables.zones(RESTAURANT_A);

/** Every cache entry a table write could plausibly touch, for two restaurants. */
const keys = {
  summaryToday: queryKeys.opsDashboard.summary(RESTAURANT_A, null),
  summaryOtherDate: queryKeys.opsDashboard.summary(RESTAURANT_A, '2026-09-27'),
  heatmap: queryKeys.opsDashboard.heatmap(RESTAURANT_A, '2026-09-01', '2026-09-30'),
  timeline: queryKeys.opsTables.timeline(RESTAURANT_A, { date: '2026-09-26' }),
  floorPlanTables: queryKeys.opsTables.list(RESTAURANT_A),
  allowedCapacities: queryKeys.opsTables.allowedCapacities(RESTAURANT_A),
  otherSummary: queryKeys.opsDashboard.summary(RESTAURANT_B, null),
  otherTables: queryKeys.opsTables.list(RESTAURANT_B),
} satisfies Record<string, QueryKey>;

function seed(queryClient: QueryClient) {
  for (const key of Object.values(keys)) {
    queryClient.setQueryData(key, { seeded: true });
  }
  const tables: ListTablesResult = { tables: [table], summary: null };
  queryClient.setQueryData(keys.floorPlanTables, tables);
  queryClient.setQueryData(keys.otherTables, tables);
}

function invalidated(queryClient: QueryClient, key: QueryKey) {
  return queryClient.getQueryState(key)?.isInvalidated ?? false;
}

function render(queryClient: QueryClient) {
  const tableService = {
    list: vi.fn(),
    create: vi.fn().mockResolvedValue(table),
    update: vi.fn().mockResolvedValue({ ...table, tableNumber: '1A' }),
    remove: vi.fn().mockResolvedValue(undefined),
    timeline: vi.fn(),
  } as unknown as TableInventoryService;
  const zoneService = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as ZoneService;
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
    () =>
      useTableInventoryMutations({
        restaurantId: RESTAURANT_A,
        tablesQueryKey: tablesKey,
        zonesQueryKey: zonesKey,
        onTableSaved: vi.fn(),
        onTableNumberConflict: vi.fn(),
        onTableDeleted: vi.fn(),
        onZoneCreated: vi.fn(),
        onZoneSaved: vi.fn(),
        onZoneDeleted: vi.fn(),
      }),
    { wrapper },
  );
}

describe('useTableInventoryMutations dependent invalidation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createAppQueryClient();
    seed(queryClient);
  });

  function expectRestaurantTablesInvalidated() {
    expect(invalidated(queryClient, keys.timeline)).toBe(true);
    expect(invalidated(queryClient, keys.floorPlanTables)).toBe(true);
    expect(invalidated(queryClient, keys.allowedCapacities)).toBe(true);
  }

  function expectOtherRestaurantUntouched() {
    expect(invalidated(queryClient, keys.otherSummary)).toBe(false);
    expect(invalidated(queryClient, keys.otherTables)).toBe(false);
    // Heatmaps count bookings, never table labels.
    expect(invalidated(queryClient, keys.heatmap)).toBe(false);
  }

  it('a rename refetches every dashboard summary date that shows table labels', async () => {
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.updateMutation.mutateAsync({
        tableId: table.id,
        payload: { tableNumber: '1A' },
      });
    });

    expect(invalidated(queryClient, keys.summaryToday)).toBe(true);
    expect(invalidated(queryClient, keys.summaryOtherDate)).toBe(true);
    expectRestaurantTablesInvalidated();
    expectOtherRestaurantUntouched();
  });

  it('a delete refetches the dashboard summaries and the floor plan', async () => {
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.deleteMutation.mutateAsync({ table });
    });

    expect(invalidated(queryClient, keys.summaryToday)).toBe(true);
    expectRestaurantTablesInvalidated();
    expectOtherRestaurantUntouched();
  });

  it('a create refreshes table views but leaves summaries alone (no booking can reference it yet)', async () => {
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.createMutation.mutateAsync({
        restaurantId: RESTAURANT_A,
        payload: {
          tableNumber: '9',
          capacity: 4,
          minPartySize: 1,
          category: 'dining',
          seatingType: 'standard',
          mobility: 'movable',
          zoneId: 'zone-main',
          status: 'available',
          active: true,
        },
      });
    });

    expect(invalidated(queryClient, keys.summaryToday)).toBe(false);
    expectRestaurantTablesInvalidated();
    expectOtherRestaurantUntouched();
  });

  it('a quick fix (status/active) leaves summaries alone: they do not show either field', async () => {
    const { result } = render(queryClient);

    await act(async () => {
      await result.current.quickFixMutation.mutateAsync({
        table,
        patch: { active: false },
        undo: null,
        message: 'Table 1 is off.',
      });
    });

    expect(invalidated(queryClient, keys.summaryToday)).toBe(false);
    expect(invalidated(queryClient, keys.timeline)).toBe(true);
  });
});
