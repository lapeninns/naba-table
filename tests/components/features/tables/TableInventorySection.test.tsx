import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  buildTableZoneLookup,
  DEFAULT_TABLE_LIST_FILTERS,
  groupTablesByZone,
} from '@/components/features/tables/tableInventoryDisplayDomain';
import { TableInventorySection } from '@/components/features/tables/TableInventorySection';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 },
  { id: 'zone-patio', name: 'Patio', active: false, sortOrder: 1 },
];

function makeTable(overrides: Partial<TableInventory> & { id: string }): TableInventory {
  return {
    restaurantId: 'rest-1',
    tableNumber: overrides.id,
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

const tables = [
  makeTable({ id: '10', seatingType: 'booth', mobility: 'fixed', notes: 'By the window' }),
  makeTable({ id: '2', minPartySize: 2, maxPartySize: 4 }),
  makeTable({ id: '3', active: false }),
  makeTable({ id: 'P1', zoneId: 'zone-patio', zoneName: 'Patio', zoneActive: false }),
];

type SectionProps = Parameters<typeof TableInventorySection>[0];

function renderSection(overrides: Partial<SectionProps> = {}) {
  const props: SectionProps = {
    isLoading: false,
    isDeletePending: false,
    canDeleteTables: true,
    filters: DEFAULT_TABLE_LIST_FILTERS,
    zoneOptions: zones,
    zoneLookup: buildTableZoneLookup(zones),
    totalTables: tables.length,
    shownTables: tables.length,
    groups: groupTablesByZone(tables, zones),
    onAddTable: vi.fn(),
    onClearFilters: vi.fn(),
    onEditTable: vi.fn(),
    onDeleteTable: vi.fn(),
    onSearchChange: vi.fn(),
    onZoneFilterChange: vi.fn(),
    onBookableFilterChange: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <TableInventorySection {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe('TableInventorySection', () => {
  it('lists tables grouped by zone with one Bookings status per table', () => {
    renderSection();

    const table = screen.getByRole('table', { name: 'Tables grouped by zone' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Table', 'Seats', 'Party size', 'Details', 'Bookings', 'Actions']);

    const rowNames = within(table)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent);
    expect(rowNames).toEqual(['2', '3', '10', 'P1']);

    expect(within(screen.getByTestId('table-row-2')).getByText('2–4')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('table-row-10')).getByText('Booth · Fixed · By the window'),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('table-row-2')).getByText('Bookable')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('table-row-3')).getByText('Not bookable: turned off'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('table-row-P1')).getByText('Not bookable: Patio is out of service'),
    ).toBeInTheDocument();
    expect(screen.getByText('4 tables')).toBeInTheDocument();
  });

  it('shows the same content on mobile cards', () => {
    renderSection();

    const card = screen.getByTestId('table-card-10');
    expect(within(card).getByText('Table 10')).toBeInTheDocument();
    expect(
      within(card).getByText('4 seats · parties of 1–4 · Booth · Fixed · By the window'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Bookable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Patio · out of service' })).toBeInTheDocument();
  });

  it('edits and deletes a table from its row', async () => {
    const user = userEvent.setup();
    const props = renderSection();

    const row = screen.getByTestId('table-row-2');
    await user.click(within(row).getByRole('button', { name: 'Edit table 2' }));
    expect(props.onEditTable).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
    await user.click(within(row).getByRole('button', { name: 'Delete table 2' }));
    expect(props.onDeleteTable).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
  });

  it('explains that deleting is for owners and managers instead of disabling silently', () => {
    renderSection({ canDeleteTables: false });

    expect(screen.getByText('Only owners and managers can delete tables.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete table/ })).not.toBeInTheDocument();
  });

  it('searches and filters from the toolbar', async () => {
    const user = userEvent.setup();
    const props = renderSection({
      filters: { ...DEFAULT_TABLE_LIST_FILTERS, bookable: 'bookable' },
      shownTables: 1,
    });

    expect(screen.getByText('Showing 1 of 4')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'w');
    expect(props.onSearchChange).toHaveBeenCalledWith('w');

    const show = screen.getByRole('group', { name: 'Show' });
    expect(within(show).getByRole('button', { name: 'Bookable' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(show).getByRole('button', { name: 'Not bookable' }));
    expect(props.onBookableFilterChange).toHaveBeenCalledWith('not-bookable');
    expect(screen.getByRole('combobox', { name: 'Zone' })).toHaveTextContent('All zones');
  });

  it('shows empty states with the next step', async () => {
    const user = userEvent.setup();
    const props = renderSection({ totalTables: 4, shownTables: 0, groups: [] });

    expect(screen.getByText('No tables match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('offers Add table when there are zones but no tables', async () => {
    const user = userEvent.setup();
    const props = renderSection({ totalTables: 0, shownTables: 0, groups: [] });

    expect(screen.getByText('No tables yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add table' }));
    expect(props.onAddTable).toHaveBeenCalledTimes(1);
  });

  it('shows a loading placeholder on first load', () => {
    renderSection({ isLoading: true });
    expect(screen.getByText('Loading tables')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
