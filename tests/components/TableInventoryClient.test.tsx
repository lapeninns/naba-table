import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TableInventoryClient from '@/components/features/tables/TableInventoryClient';
import {
  CATEGORY_OPTIONS,
  MOBILITY_OPTIONS,
  SEATING_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '@/components/features/tables/tableInventoryModel';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { HttpError } from '@/lib/http/errors';
import { Constants } from '@/types/supabase';

import type {
  ListTablesResult,
  TableInventory,
  TableInventoryService,
} from '@/services/ops/tables';
import type ZoneService from '@/services/ops/zones';
import type { Zone } from '@/services/ops/zones';
import type { OpsMembership, OpsUser } from '@/types/ops';

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toastMocks }));

const opsUser: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const ownerMemberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    role: 'owner',
    createdAt: null,
  },
];

function makeTable(overrides: Partial<TableInventory> & { id: string }): TableInventory {
  return {
    restaurantId: 'rest-1',
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

function buildTablesResult(): ListTablesResult {
  return {
    tables: [
      makeTable({ id: 'table-1', tableNumber: '1', notes: 'Window seat' }),
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
      serviceCapacities: [
        {
          key: 'dinner',
          label: 'Dinner',
          capacity: 16,
          tablesConsidered: 2,
          turnsPerTable: 2,
          seatsPerTurn: 8,
          assumptions: {
            windowMinutes: 240,
            turnMinutes: 90,
            bufferMinutes: 15,
            intervalMinutes: 15,
          },
        },
      ],
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

function createZoneService(overrides: Record<string, unknown> = {}) {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  } as unknown as ZoneService;
}

function renderClient(options?: {
  memberships?: OpsMembership[];
  tableService?: TableInventoryService;
  zoneService?: ZoneService;
}) {
  const activeMemberships = options?.memberships ?? ownerMemberships;
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
          user={activeMemberships.length > 0 ? opsUser : null}
          memberships={activeMemberships}
          initialRestaurantId={activeMemberships[0]?.restaurantId ?? null}
        >
          <TableInventoryClient />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

function tablesList() {
  return screen.getByRole('region', { name: 'Tables' });
}

function zonesPanel() {
  return screen.getByRole('region', { name: 'Zones' });
}

beforeEach(() => {
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
});

describe('TableInventoryClient', () => {
  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderClient({ memberships: [] });

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tables' })).not.toBeInTheDocument();
  });

  it('shows load errors with the reason code and a retry action, never the raw message', async () => {
    const tableService = createTableService({
      list: vi
        .fn()
        .mockRejectedValue(
          new HttpError({ message: 'secret detail', status: 503, code: 'HTTP_503' }),
        ),
    });

    renderClient({ tableService });

    expect(await screen.findByText('Tables couldn’t be loaded')).toBeInTheDocument();
    expect(screen.getByText('HTTP_503')).toHaveClass('font-mono');
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the summary, zones and tables on one screen without a workflow rail', async () => {
    const tableService = createTableService();
    const zoneService = createZoneService();

    renderClient({ tableService, zoneService });

    const summary = await screen.findByTestId('table-inventory-metrics');
    expect(within(summary).getByText('Bookable now')).toBeInTheDocument();
    expect(within(summary).getByText('2 tables')).toBeInTheDocument();
    expect(within(summary).getByText('8 seats')).toBeInTheDocument();
    expect(within(summary).getByText('Every table can be booked')).toBeInTheDocument();
    expect(within(summary).getByText('All in service')).toBeInTheDocument();
    expect(within(summary).getByText('Dinner: 16 covers')).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Change meal times' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/availability#service-windows'),
    );

    expect(screen.queryByText('Tables workflow')).not.toBeInTheDocument();
    expect(within(zonesPanel()).getByRole('button', { name: 'Patio' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      within(tablesList()).getByRole('columnheader', { name: 'Bookings' }),
    ).toBeInTheDocument();
    expect(within(tablesList()).getAllByText('Bookable').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add table' })).toBeEnabled();

    await waitFor(() => {
      expect(tableService.list).toHaveBeenCalledTimes(1);
    });
    expect(zoneService.list).not.toHaveBeenCalled();
  });

  it('filters by zone from the zone name and by search while keeping focus in the search box', async () => {
    const user = userEvent.setup();
    renderClient();

    const patio = await within(await screen.findByRole('region', { name: 'Zones' })).findByRole(
      'button',
      { name: 'Patio' },
    );
    await user.click(patio);
    expect(patio).toHaveAttribute('aria-pressed', 'true');
    expect(within(tablesList()).getByText('Showing 1 of 2')).toBeInTheDocument();
    expect(within(tablesList()).queryByTestId('table-row-table-1')).not.toBeInTheDocument();

    await user.click(patio);
    expect(patio).toHaveAttribute('aria-pressed', 'false');

    const search = within(tablesList()).getByRole('searchbox', { name: 'Search' });
    await user.type(search, 'window');
    expect(search).toHaveFocus();
    expect(search).toHaveValue('window');
    expect(within(tablesList()).getByTestId('table-row-table-1')).toBeInTheDocument();
    expect(within(tablesList()).queryByTestId('table-row-table-2')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'nothing');
    expect(within(tablesList()).getByText('No tables match')).toBeInTheDocument();
    await user.click(within(tablesList()).getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
  });

  it('shows one computed Bookings status and filters bookable tables', async () => {
    const user = userEvent.setup();
    const result = buildTablesResult();
    result.tables[1] = { ...result.tables[1], status: 'out_of_service' };
    renderClient({ tableService: createTableService({ list: vi.fn().mockResolvedValue(result) }) });

    const list = await screen.findByRole('region', { name: 'Tables' });
    expect(
      await within(list).findAllByText('Not bookable: marked out of service'),
    ).not.toHaveLength(0);
    expect(within(list).queryByText('Blocked by zone')).not.toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Not bookable' }));
    expect(within(list).getByRole('button', { name: 'Not bookable' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(list).queryByTestId('table-row-table-1')).not.toBeInTheDocument();
    expect(within(list).getByTestId('table-row-table-2')).toBeInTheDocument();
  });

  it('updates the zone switch at once and rolls it back when the save fails', async () => {
    const user = userEvent.setup();
    let rejectUpdate: (error: unknown) => void = () => undefined;
    const zoneService = createZoneService({
      update: vi.fn(
        () =>
          new Promise<Zone>((_resolve, reject) => {
            rejectUpdate = reject;
          }),
      ),
    });
    renderClient({ zoneService });

    const zoneSwitch = await within(
      await screen.findByRole('region', { name: 'Zones' }),
    ).findByRole('switch', { name: 'Patio in service' });
    expect(zoneSwitch).toBeChecked();

    await user.click(zoneSwitch);

    await waitFor(() => expect(zoneSwitch).not.toBeChecked());
    expect(within(zonesPanel()).getByText('Tables kept, not bookable')).toBeInTheDocument();
    expect(
      within(tablesList()).getAllByText('Not bookable: Patio is out of service').length,
    ).toBeGreaterThan(0);
    expect(zoneService.update).toHaveBeenCalledWith('zone-patio', {
      name: undefined,
      sortOrder: undefined,
      active: false,
    });

    rejectUpdate(new HttpError({ message: 'nope', status: 500 }));

    await waitFor(() => expect(zoneSwitch).toBeChecked());
    expect(toastMocks.error).toHaveBeenCalledWith(
      'Patio wasn’t changed. The switch is back to its saved setting.',
      expect.anything(),
    );
  });

  it('with no zones, Add table asks for a zone first and then opens the table dialog', async () => {
    const user = userEvent.setup();
    const createdZone: Zone = {
      id: 'zone-new',
      restaurantId: 'rest-1',
      name: 'Terrace',
      sortOrder: 0,
      active: true,
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
    };
    const zoneService = createZoneService({
      create: vi.fn().mockResolvedValue(createdZone),
    });
    // The next list read after the zone is created returns it, as the API would.
    const list = vi.fn(async (): Promise<ListTablesResult> => {
      const empty = buildEmptyTablesResult();
      if (vi.mocked(zoneService.create).mock.calls.length === 0 || !empty.summary) return empty;
      return {
        ...empty,
        summary: {
          ...empty.summary,
          zones: [{ id: 'zone-new', name: 'Terrace', active: true, sortOrder: 0 }],
        },
      };
    });
    renderClient({ tableService: createTableService({ list }), zoneService });

    expect(
      await within(await screen.findByRole('region', { name: 'Zones' })).findByText('No zones yet'),
    ).toBeInTheDocument();
    expect(screen.getByText('Add a zone first, then your tables.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add table' }));
    const zoneDialog = await screen.findByRole('dialog', { name: 'Add zone' });
    await user.click(within(zoneDialog).getByRole('button', { name: 'Add zone and continue' }));

    const nameInput = within(zoneDialog).getByLabelText('Zone name');
    expect(await within(zoneDialog).findByText('Enter a zone name')).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    expect(zoneService.create).not.toHaveBeenCalled();

    await user.type(nameInput, 'Terrace');
    await user.click(within(zoneDialog).getByRole('button', { name: 'Add zone and continue' }));

    await waitFor(() => {
      expect(zoneService.create).toHaveBeenCalledWith('rest-1', 'Terrace', 0);
    });
    expect(toastMocks.success).toHaveBeenCalledWith('Zone “Terrace” added.');
    const tableDialog = await screen.findByRole('dialog', { name: 'Add table' });
    expect(within(tableDialog).getByRole('combobox', { name: 'Zone' })).toHaveTextContent(
      'Terrace',
    );
  });

  it('shows a duplicate table number as a field error when the server returns 409', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({
      create: vi
        .fn()
        .mockRejectedValue(new HttpError({ message: 'Conflict', status: 409, code: 'HTTP_409' })),
    });
    renderClient({ tableService });

    await screen.findByTestId('table-row-table-1');
    await user.click(screen.getByRole('button', { name: 'Add table' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add table' });
    await user.type(within(dialog).getByLabelText('Table number'), '1');
    await user.click(within(dialog).getByRole('button', { name: 'Save table' }));

    expect(await within(dialog).findByText('Table 1 already exists')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Table number')).toHaveAttribute('aria-invalid', 'true');
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and toasts the reason code when a table save fails', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({
      create: vi
        .fn()
        .mockRejectedValue(new HttpError({ message: 'Server', status: 500, code: 'HTTP_500' })),
    });
    renderClient({ tableService });

    await screen.findByTestId('table-row-table-1');
    await user.click(screen.getByRole('button', { name: 'Add table' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add table' });
    await user.type(within(dialog).getByLabelText('Table number'), '7');
    await user.click(within(dialog).getByRole('button', { name: 'Save table' }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Table wasn’t saved. Your details are still here.',
        expect.objectContaining({ description: expect.anything() }),
      );
    });
    expect(screen.getByRole('dialog', { name: 'Add table' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Table number')).toHaveValue('7');
  });

  it('confirms a table delete by naming the effect', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({ remove: vi.fn().mockResolvedValue(undefined) });
    renderClient({ tableService });

    const row = await screen.findByTestId('table-row-table-1');
    await user.click(within(row).getByRole('button', { name: 'Delete table 1' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Delete table 1?' });
    expect(
      within(confirm).getByText(
        'It can no longer be given to bookings. This can’t be undone. To keep it for later, turn it off instead.',
      ),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Delete table' }));

    await waitFor(() => expect(tableService.remove).toHaveBeenCalledWith('table-1'));
    expect(toastMocks.success).toHaveBeenCalledWith('Table 1 deleted.');
  });

  it('explains why a zone with tables cannot be deleted and offers to show its tables', async () => {
    const user = userEvent.setup();
    const zoneService = createZoneService();
    renderClient({ zoneService });

    const panel = await screen.findByRole('region', { name: 'Zones' });
    await user.click(await within(panel).findByRole('button', { name: 'Delete Main' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Main still has tables' });
    expect(
      within(dialog).getByText(
        'Move or delete its 1 table before deleting the zone. To stop bookings for now, take the zone out of service instead.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Show its tables' }));

    expect(within(zonesPanel()).getByRole('button', { name: 'Main' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(tablesList()).queryByTestId('table-row-table-2')).not.toBeInTheDocument();
    expect(zoneService.remove).not.toHaveBeenCalled();
  });

  it('explains that only owners and managers can delete tables', async () => {
    renderClient({
      memberships: [{ ...ownerMemberships[0], role: 'host' }],
    });

    const row = await screen.findByTestId('table-row-table-1');
    expect(within(row).queryByRole('button', { name: /Delete table/ })).not.toBeInTheDocument();
    expect(
      within(tablesList()).getByText('Only owners and managers can delete tables.'),
    ).toBeInTheDocument();
  });
});

describe('table inventory options', () => {
  it('uses generated Supabase table enums for editable table option values', () => {
    expect(CATEGORY_OPTIONS.map((option) => option.value)).toEqual([
      ...Constants.public.Enums.table_category,
    ]);
    expect(SEATING_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      ...Constants.public.Enums.table_seating_type,
    ]);
    expect(MOBILITY_OPTIONS.map((option) => option.value)).toEqual([
      ...Constants.public.Enums.table_mobility,
    ]);
    expect(STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...Constants.public.Enums.table_status,
    ]);
  });
});
