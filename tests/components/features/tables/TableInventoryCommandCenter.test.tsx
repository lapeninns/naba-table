import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryCommandCenter } from '@/components/features/tables/TableInventoryCommandCenter';

import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

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

const summary: TableInventorySummary = {
  totalTables: 2,
  totalCapacity: 8,
  availableTables: 2,
  zones: [
    { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 },
    { id: 'zone-patio', name: 'Patio', active: false, sortOrder: 1 },
  ],
  serviceCapacities: [],
};

const tables = [
  makeTable({ id: 'table-1' }),
  makeTable({ id: 'table-2', active: false }),
];

type CommandCenterProps = Parameters<typeof TableInventoryCommandCenter>[0];

function makeProps(overrides: Partial<CommandCenterProps> = {}): CommandCenterProps {
  return {
    activeWorkspace: 'summary',
    children: <div>workspace body</div>,
    summary,
    tables,
    onSelectWorkspace: vi.fn(),
    ...overrides,
  };
}

describe('TableInventoryCommandCenter', () => {
  it('@contract renders the header, workflow rail, and children', () => {
    render(<TableInventoryCommandCenter {...makeProps()} />);

    expect(screen.getByText('Tables command center')).toBeInTheDocument();
    expect(screen.getByText('Tables workflow')).toBeInTheDocument();
    expect(screen.getByText('workspace body')).toBeInTheDocument();
    expect(
      screen.getByText('Only active tables in active zones count as service-ready capacity.'),
    ).toBeInTheDocument();
  });

  it('@contract derives bookable-capacity metrics from the summary and tables', () => {
    render(<TableInventoryCommandCenter {...makeProps()} />);

    expect(screen.getByText('Bookable tables')).toBeInTheDocument();
    // One of the two tables is inactive, so a single bookable table remains.
    expect(screen.getByText('1 tables')).toBeInTheDocument();
    expect(screen.getByText('4 covers')).toBeInTheDocument();
  });

  it('@contract @a11y marks the active workspace with aria-current', () => {
    render(<TableInventoryCommandCenter {...makeProps({ activeWorkspace: 'zones' })} />);

    expect(screen.getByRole('button', { name: /Zones/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Capacity summary/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('@contract fires onSelectWorkspace for each rail item', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryCommandCenter {...props} />);

    await user.click(screen.getByRole('button', { name: /Zones/ }));
    expect(props.onSelectWorkspace).toHaveBeenLastCalledWith('zones');

    await user.click(screen.getByRole('button', { name: /Inventory/ }));
    expect(props.onSelectWorkspace).toHaveBeenLastCalledWith('inventory');

    await user.click(screen.getByRole('button', { name: /Capacity summary/ }));
    expect(props.onSelectWorkspace).toHaveBeenLastCalledWith('summary');
  });
});
