import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TableInventoryClient from '@/components/features/tables/TableInventoryClient';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type {
  ListTablesResult,
  TableInventory,
  TableInventoryService,
} from '@/services/ops/tables';
import type ZoneService from '@/services/ops/zones';
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

function makeTable(overrides: Partial<TableInventory> & { id: string }): TableInventory {
  return {
    id: overrides.id,
    restaurantId: 'rest-1',
    tableNumber: overrides.tableNumber ?? '1',
    capacity: overrides.capacity ?? 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: overrides.zoneId ?? 'zone-main',
    zoneName: overrides.zoneName ?? 'Main',
    zoneActive: overrides.zoneActive ?? true,
    active: overrides.active ?? true,
    status: overrides.status ?? 'available',
    position: null,
    notes: null,
  };
}

function buildTablesResult(): ListTablesResult {
  return {
    tables: [
      makeTable({ id: 'table-1', tableNumber: '1', zoneId: 'zone-main', zoneName: 'Main' }),
      makeTable({ id: 'table-2', tableNumber: '2', zoneId: 'zone-patio', zoneName: 'Patio' }),
    ],
    summary: {
      totalTables: 2,
      totalCapacity: 8,
      availableTables: 2,
      zones: [
        { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 },
        { id: 'zone-patio', name: 'Patio', active: true, sortOrder: 1 },
      ],
      serviceCapacities: [],
    },
  };
}

function createTableService(overrides: Partial<TableInventoryService> = {}): TableInventoryService {
  return {
    list: vi.fn().mockResolvedValue(buildTablesResult()),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    timeline: vi.fn(),
    ...overrides,
  } as TableInventoryService;
}

function createZoneService() {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  } as unknown as ZoneService;
}

function renderClient(options?: {
  tableService?: TableInventoryService;
  zoneService?: ZoneService;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          tableInventoryService: () => options?.tableService ?? createTableService(),
          zoneService: () => options?.zoneService ?? createZoneService(),
        }}
      >
        <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
          <TableInventoryClient />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

describe('TableInventoryClient', () => {
  it('uses zones from the tables summary instead of issuing a duplicate initial zones request', async () => {
    const tableService = createTableService();
    const zoneService = createZoneService();

    renderClient({ tableService, zoneService });

    expect(await screen.findByText('Table Inventory')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Patio' })).toBeInTheDocument();

    await waitFor(() => {
      expect(tableService.list).toHaveBeenCalledTimes(1);
    });
    expect(zoneService.list).not.toHaveBeenCalled();
  });
});
