import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TableInventoryClient from '@/components/features/tables/TableInventoryClient';
import {
  filterTablesByStatus,
  filterZonesByStatus,
} from '@/components/features/tables/tableInventoryModel';
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

function buildEmptyTablesResult(): ListTablesResult {
  return {
    tables: [],
    summary: {
      totalTables: 0,
      totalCapacity: 0,
      availableTables: 0,
      zones: [],
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
  memberships?: OpsMembership[];
  tableService?: TableInventoryService;
  zoneService?: ZoneService;
}) {
  const activeMemberships = options?.memberships ?? memberships;
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
        <OpsSessionProvider
          user={activeMemberships.length > 0 ? user : null}
          memberships={activeMemberships}
          initialRestaurantId={activeMemberships[0]?.restaurantId ?? null}
        >
          <TableInventoryClient />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

describe('TableInventoryClient', () => {
  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderClient({ memberships: [] });

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByText('Table Inventory')).not.toBeInTheDocument();
  });

  it('shows load errors with a retry action', async () => {
    const tableService = createTableService({
      list: vi.fn().mockRejectedValue(new Error('Tables failed to load.')),
    });

    renderClient({ tableService });

    expect(await screen.findByText('Unable to load tables')).toBeInTheDocument();
    expect(screen.getByText('Tables failed to load.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows empty zone and table states when inventory has not been configured', async () => {
    const tableService = createTableService({
      list: vi.fn().mockResolvedValue(buildEmptyTablesResult()),
    });

    renderClient({ tableService });

    expect(
      await screen.findByText(
        'No zones configured yet. Create your first zone to start organizing tables.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No tables configured yet. Add your first table to get started.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add table' })).toBeDisabled();
  });

  it('uses zones from the tables summary instead of issuing a duplicate initial zones request', async () => {
    const user = userEvent.setup();
    const tableService = createTableService();
    const zoneService = createZoneService();

    renderClient({ tableService, zoneService });

    expect(await screen.findByText('Table Inventory')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Patio' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add zone' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zone options' }));
    expect(screen.getByRole('button', { name: 'Add zone' })).toBeInTheDocument();

    await waitFor(() => {
      expect(tableService.list).toHaveBeenCalledTimes(1);
    });
    expect(zoneService.list).not.toHaveBeenCalled();
  });
});

describe('table inventory filters', () => {
  it('separates active and inactive tables using both table and zone status', () => {
    const active = makeTable({ id: 'active', active: true, zoneActive: true });
    const inactiveTable = makeTable({ id: 'inactive-table', active: false, zoneActive: true });
    const inactiveZone = makeTable({ id: 'inactive-zone', active: true, zoneActive: false });

    expect(filterTablesByStatus([active, inactiveTable, inactiveZone], 'active')).toEqual([active]);
    expect(filterTablesByStatus([active, inactiveTable, inactiveZone], 'inactive')).toEqual([
      inactiveTable,
      inactiveZone,
    ]);
    expect(filterTablesByStatus([active, inactiveTable, inactiveZone], 'all')).toEqual([
      active,
      inactiveTable,
      inactiveZone,
    ]);
  });

  it('filters zones by active state without changing the all-zones ordering', () => {
    const active = { id: 'active-zone', name: 'Active', active: true, sortOrder: 0 };
    const inactive = { id: 'inactive-zone', name: 'Inactive', active: false, sortOrder: 1 };

    expect(filterZonesByStatus([active, inactive], 'active')).toEqual([active]);
    expect(filterZonesByStatus([active, inactive], 'inactive')).toEqual([inactive]);
    expect(filterZonesByStatus([active, inactive], 'all')).toEqual([active, inactive]);
  });
});
