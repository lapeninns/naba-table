import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventorySection } from '@/components/features/tables/TableInventorySection';
import { ALL_ZONES_VALUE } from '@/components/features/tables/tableInventoryModel';

import type { TableInventory } from '@/services/ops/tables';

function makeTable(overrides: Partial<TableInventory> & { id: string }): TableInventory {
  return {
    restaurantId: 'rest-1',
    tableNumber: overrides.id.replace('table-', ''),
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

type SectionProps = Parameters<typeof TableInventorySection>[0];

function makeProps(overrides: Partial<SectionProps> = {}): SectionProps {
  const tables = [makeTable({ id: 'table-1' })];
  return {
    isActive: true,
    isLoading: false,
    isFetching: false,
    isAddTableDisabled: false,
    isDeletePending: false,
    canDeleteTables: true,
    selectedZoneId: ALL_ZONES_VALUE,
    tableStatusFilter: 'active',
    zoneOptions: [{ id: 'zone-main', name: 'Main', active: true }],
    tables,
    filteredTables: tables,
    onAddTable: vi.fn(),
    onEditTable: vi.fn(),
    onDeleteTable: vi.fn(),
    onZoneFilterChange: vi.fn(),
    onTableStatusFilterChange: vi.fn(),
    ...overrides,
  };
}

describe('TableInventorySection', () => {
  it('@contract renders the card header with an Add table action that fires', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventorySection {...props} />);

    expect(screen.getByText('Table inventory')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add table' }));
    expect(props.onAddTable).toHaveBeenCalledTimes(1);
  });

  it('@contract disables Add table until a zone exists', () => {
    render(<TableInventorySection {...makeProps({ isAddTableDisabled: true })} />);

    expect(screen.getByRole('button', { name: 'Add table' })).toBeDisabled();
  });

  it('@contract renders both mobile cards and the desktop table for the same rows', () => {
    render(<TableInventorySection {...makeProps()} />);

    // Desktop layout: a table row per record.
    const table = screen.getByRole('table');
    expect(within(table).getByRole('button', { name: 'Edit table' })).toBeInTheDocument();

    // Mobile layout: an article card per record.
    const card = screen.getByRole('article');
    expect(within(card).getByRole('heading', { name: 'Table 1' })).toBeInTheDocument();
  });

  it('@contract forwards edit callbacks from the desktop layout with the row table', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventorySection {...props} />);

    const table = screen.getByRole('table');
    await user.click(within(table).getByRole('button', { name: 'Edit table' }));

    expect(props.onEditTable).toHaveBeenCalledWith(props.tables[0]);
  });

  it('@contract shows loading rows while the list is loading or refetching', () => {
    render(<TableInventorySection {...makeProps({ isFetching: true })} />);

    // Both responsive layouts surface a loading placeholder.
    expect(screen.getAllByText('Loading tables…').length).toBe(2);
  });

  it('@contract shows layout-specific empty messages when no tables exist', () => {
    render(<TableInventorySection {...makeProps({ tables: [], filteredTables: [] })} />);

    expect(
      screen.getByText(
        'Add your first tables. Start with table number and capacity; advanced details can come later.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'No table records yet. Add tables with number and capacity first; advanced details can come later.',
      ),
    ).toBeInTheDocument();
  });

  it('@contract hides the section when the inventory workspace is inactive', () => {
    render(<TableInventorySection {...makeProps({ isActive: false })} />);

    expect(screen.getByText('Table inventory')).not.toBeVisible();
  });
});
