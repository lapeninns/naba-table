import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
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

/** The sheet footer's Close, not the dialog's corner close button. */
function footerClose(sheet: HTMLElement) {
  const button = within(sheet)
    .getAllByRole('button', { name: 'Close' })
    .find((item) => !item.querySelector('svg'));
  if (!button) throw new Error('No footer Close button');
  return button;
}

function room() {
  return screen.getByTestId('room');
}

/** Wide screens show table details in the side panel instead of a sheet. */
function useWideScreen() {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 1100px') || query.includes('min-width: 640px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

beforeEach(() => {
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
});

describe('TableInventoryClient', () => {
  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderClient({ memberships: [] });

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByTestId('room')).not.toBeInTheDocument();
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

  it('shows the room zone by zone with capacity, joining and the page status', async () => {
    const tableService = createTableService();
    const zoneService = createZoneService();

    renderClient({ tableService, zoneService });

    const main = await screen.findByRole('region', { name: 'Main' });
    expect(within(main).getByText('1 table · 4 seats')).toBeInTheDocument();
    expect(within(main).getByText('All seats bookable')).toBeInTheDocument();
    expect(within(main).getByText('No tables to join here')).toBeInTheDocument();
    expect(within(main).getByRole('switch', { name: 'In service' })).toBeChecked();
    expect(
      within(main).getByRole('button', {
        name: 'Table 1, 4 seats, parties of 1–4, can be joined, bookable',
      }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(within(main).getByRole('button', { name: 'Add table to Main' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Patio' })).toBeInTheDocument();

    expect(screen.getByText('8 of 8 seats bookable')).toBeInTheDocument();
    expect(screen.getByText('Every table can be booked')).toBeInTheDocument();

    const capacity = screen.getByTestId('table-capacity-card');
    expect(
      within(capacity).getByRole('img', { name: '8 of 8 seats bookable' }),
    ).toBeInTheDocument();
    expect(within(capacity).getByText('16 covers')).toBeInTheDocument();
    expect(within(capacity).getByRole('link', { name: 'Change meal times' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/availability#service-windows'),
    );

    await waitFor(() => expect(tableService.list).toHaveBeenCalledTimes(1));
    expect(zoneService.list).not.toHaveBeenCalled();
  });

  it('fades tables that do not match the search and lists them in the list view', async () => {
    const user = userEvent.setup();
    renderClient();

    const tile2 = await screen.findByRole('button', { name: /^Table 2,/ });
    const search = screen.getByRole('searchbox', { name: 'Find a table' });
    await user.type(search, 'window');
    expect(search).toHaveFocus();
    expect(tile2).toHaveClass('opacity-45');
    expect(screen.getByRole('button', { name: /^Table 1,/ })).not.toHaveClass('opacity-45');
    expect(within(room()).getByText(/Tables that don’t match are faded/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'List' }));
    const list = within(room()).getByRole('table', { name: 'All tables' });
    expect(within(list).getByRole('rowheader', { name: '1' })).toBeInTheDocument();
    expect(within(list).queryByRole('rowheader', { name: '2' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'nothing');
    expect(within(list).getByText(/No tables match/)).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
  });

  it('shows why a table cannot be booked and points to it from the page status', async () => {
    const user = userEvent.setup();
    const result = buildTablesResult();
    result.tables[1] = { ...result.tables[1]!, status: 'out_of_service' };
    renderClient({ tableService: createTableService({ list: vi.fn().mockResolvedValue(result) }) });

    const tile = await screen.findByRole('button', {
      name: 'Table 2, 4 seats, parties of 1–4, can be joined, not bookable: out of service',
    });
    expect(within(tile).getByText('Out of service')).toBeInTheDocument();
    expect(screen.getByText('4 of 8 seats bookable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1 table needs a look' }));
    expect(screen.getByRole('button', { name: 'Not bookable' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Table 1,/ })).toHaveClass('opacity-45');
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

    const patio = await screen.findByRole('region', { name: 'Patio' });
    const zoneSwitch = within(patio).getByRole('switch', { name: 'In service' });
    expect(zoneSwitch).toBeChecked();

    await user.click(zoneSwitch);

    await waitFor(() => expect(zoneSwitch).not.toBeChecked());
    expect(within(patio).getByText('Tables kept, not bookable.')).toBeInTheDocument();
    expect(within(patio).getByText('Zone off')).toBeInTheDocument();
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

  it('with no zones, Add table asks for a zone first and then opens the new table', async () => {
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

    expect(await screen.findByText('Start with a zone')).toBeInTheDocument();

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
    const sheet = await screen.findByRole('dialog', { name: 'New table in Terrace' });
    expect(within(sheet).getByRole('combobox', { name: 'Zone' })).toHaveTextContent('Terrace');
  });

  it('opens a table with its bookable and joining reasons and saves only on Save table', async () => {
    const user = userEvent.setup();
    const result = buildTablesResult();
    result.tables.push(makeTable({ id: 'table-3', tableNumber: '3', capacity: 2 }));
    const tableService = createTableService({
      list: vi.fn().mockResolvedValue(result),
      update: vi.fn(async (_id: string, payload) => ({ ...result.tables[0]!, ...payload })),
    });
    renderClient({ tableService });

    await user.click(await screen.findByRole('button', { name: /^Table 1,/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Table 1' });
    expect(within(sheet).getByTestId('bookable-reason')).toHaveTextContent(
      'Bookable. Can be given to bookings for parties of 1–4.',
    );
    expect(within(sheet).getByTestId('join-reason')).toHaveTextContent(
      'Can be joined with tables 3 in Main, up to 5 together. For example 1 + 3 seats 6.',
    );

    await user.click(within(sheet).getByRole('button', { name: 'One seat more' }));
    expect(tableService.update).not.toHaveBeenCalled();
    await user.click(within(sheet).getByRole('radio', { name: /Fixed/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save table' }));

    await waitFor(() =>
      expect(tableService.update).toHaveBeenCalledWith(
        'table-1',
        expect.objectContaining({ capacity: 5, mobility: 'fixed', tableNumber: '1' }),
      ),
    );
    expect(toastMocks.success).toHaveBeenCalledWith('Table 1 saved.');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Table 1' })).not.toBeInTheDocument(),
    );
  });

  it('shows a duplicate table number as a field error before and after saving', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({
      create: vi
        .fn()
        .mockRejectedValue(new HttpError({ message: 'Conflict', status: 409, code: 'HTTP_409' })),
    });
    renderClient({ tableService });

    await screen.findByRole('region', { name: 'Main' });
    await user.click(screen.getByRole('button', { name: 'Add table' }));
    const sheet = await screen.findByRole('dialog', { name: 'New table in Main' });
    const number = within(sheet).getByLabelText('Table number');

    await user.type(number, '1');
    await user.click(within(sheet).getByRole('button', { name: 'Add table' }));
    expect(await within(sheet).findByText('Table 1 already exists')).toBeInTheDocument();
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(tableService.create).not.toHaveBeenCalled();

    // Another operator added the same number meanwhile: the server's 409 lands on the field too.
    await user.clear(number);
    await user.type(number, '9');
    await user.click(within(sheet).getByRole('button', { name: 'Add table' }));
    expect(await within(sheet).findByText('Table 9 already exists')).toBeInTheDocument();
    expect(toastMocks.error).not.toHaveBeenCalled();
  });

  it('keeps the new table open and toasts the reason code when a save fails', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({
      create: vi
        .fn()
        .mockRejectedValue(new HttpError({ message: 'Server', status: 500, code: 'HTTP_500' })),
    });
    renderClient({ tableService });

    await screen.findByRole('region', { name: 'Main' });
    await user.click(screen.getByRole('button', { name: 'Add table to Patio' }));
    const sheet = await screen.findByRole('dialog', { name: 'New table in Patio' });
    await user.type(within(sheet).getByLabelText('Table number'), '7');
    await user.click(within(sheet).getByRole('button', { name: 'Add table' }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Table wasn’t saved. Your details are still here.',
        expect.objectContaining({ description: expect.anything() }),
      );
    });
    expect(tableService.create).toHaveBeenCalledWith(
      'rest-1',
      expect.objectContaining({ tableNumber: '7', zoneId: 'zone-patio', capacity: 4 }),
    );
    expect(within(sheet).getByLabelText('Table number')).toHaveValue('7');
  });

  it('asks before dropping unsaved edits', async () => {
    const user = userEvent.setup();
    renderClient();

    await user.click(await screen.findByRole('button', { name: /^Table 1,/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Table 1' });
    await user.type(within(sheet).getByLabelText('Notes'), ' by the door');
    await user.click(footerClose(sheet));

    const confirm = await screen.findByRole('alertdialog', {
      name: 'Discard changes to this table?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Table 1' })).toBeInTheDocument();

    await user.click(footerClose(sheet));
    await user.click(
      within(
        await screen.findByRole('alertdialog', { name: 'Discard changes to this table?' }),
      ).getByRole('button', { name: 'Discard changes' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Table 1' })).not.toBeInTheDocument(),
    );
  });

  it('confirms a table delete by naming the effect', async () => {
    const user = userEvent.setup();
    const tableService = createTableService({ remove: vi.fn().mockResolvedValue(undefined) });
    renderClient({ tableService });

    await user.click(await screen.findByRole('button', { name: /^Table 1,/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Table 1' });
    await user.click(within(sheet).getByRole('button', { name: 'Delete' }));

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

  it('offers to take a zone with tables out of service instead of deleting it', async () => {
    const user = userEvent.setup();
    const zoneService = createZoneService({
      update: vi.fn().mockResolvedValue({ id: 'zone-main', name: 'Main', active: false }),
    });
    renderClient({ zoneService });

    const main = await screen.findByRole('region', { name: 'Main' });
    await user.click(within(main).getByRole('button', { name: 'Delete Main' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Main still has tables' });
    expect(
      within(dialog).getByText(
        'Move its 1 table to another zone, or delete them, before deleting the zone. To stop bookings for now, turn the zone out of service instead.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Take out of service' }));

    await waitFor(() =>
      expect(zoneService.update).toHaveBeenCalledWith('zone-main', {
        name: undefined,
        sortOrder: undefined,
        active: false,
      }),
    );
    expect(zoneService.remove).not.toHaveBeenCalled();
  });

  it('only offers deleting a table to owners and managers', async () => {
    const user = userEvent.setup();
    renderClient({
      memberships: [{ ...ownerMemberships[0]!, role: 'host' }],
    });

    await user.click(await screen.findByRole('button', { name: /^Table 1,/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Table 1' });
    expect(within(sheet).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  describe('on wide screens', () => {
    let restore: () => void = () => undefined;
    beforeEach(() => {
      restore = useWideScreen();
    });
    afterEach(() => restore());

    it('shows the room at a glance and fixes a table from Needs a look at once', async () => {
      const user = userEvent.setup();
      const result = buildTablesResult();
      result.tables[1] = { ...result.tables[1]!, active: false };
      const tableService = createTableService({
        list: vi.fn().mockResolvedValue(result),
        update: vi.fn(() => new Promise<TableInventory>(() => undefined)),
      });
      renderClient({ tableService });

      const panel = await screen.findByRole('complementary', { name: 'Table details' });
      expect(within(panel).getByRole('heading', { name: 'Room at a glance' })).toBeInTheDocument();
      expect(await within(panel).findByText('Needs a look (1)')).toBeInTheDocument();
      expect(within(panel).getByTestId('party-coverage')).toBeInTheDocument();

      await user.click(within(panel).getByRole('button', { name: 'Turn on table 2' }));

      expect(tableService.update).toHaveBeenCalledWith('table-2', { active: true });
      // Optimistic: the table counts as bookable before the server answers.
      await waitFor(() => expect(screen.getByText('8 of 8 seats bookable')).toBeInTheDocument());
    });

    it('edits the selected table in the side panel and asks before switching away', async () => {
      const user = userEvent.setup();
      renderClient();

      const tile1 = await screen.findByRole('button', { name: /^Table 1,/ });
      await user.click(tile1);
      const panel = screen.getByRole('complementary', { name: 'Table details' });
      expect(within(panel).getByRole('heading', { name: 'Table 1' })).toBeInTheDocument();
      expect(tile1).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await user.type(within(panel).getByLabelText('Notes'), '!');
      await user.click(screen.getByRole('button', { name: /^Table 2,/ }));
      const confirm = await screen.findByRole('alertdialog', {
        name: 'Discard changes to this table?',
      });
      await user.click(within(confirm).getByRole('button', { name: 'Discard changes' }));

      await waitFor(() =>
        expect(within(panel).getByRole('heading', { name: 'Table 2' })).toBeInTheDocument(),
      );

      // Selecting the open table again closes it.
      await user.click(screen.getByRole('button', { name: /^Table 2,/ }));
      expect(within(panel).getByRole('heading', { name: 'Room at a glance' })).toBeInTheDocument();
    });
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
