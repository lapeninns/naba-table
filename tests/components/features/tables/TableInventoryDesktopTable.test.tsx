import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryDesktopTable } from '@/components/features/tables/TableInventoryDesktopTable';

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

type TableProps = Parameters<typeof TableInventoryDesktopTable>[0];

function makeProps(overrides: Partial<TableProps> = {}): TableProps {
  return {
    isLoading: false,
    canDeleteTables: true,
    isDeletePending: false,
    emptyMessage: 'No table records yet.',
    filteredTables: [makeTable({ id: 'table-1' })],
    onEditTable: vi.fn(),
    onDeleteTable: vi.fn(),
    ...overrides,
  };
}

describe('TableInventoryDesktopTable', () => {
  it('@contract shows the loading row while tables are loading', () => {
    render(<TableInventoryDesktopTable {...makeProps({ isLoading: true })} />);

    expect(screen.getByText('Loading tables…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit table' })).not.toBeInTheDocument();
  });

  it('@contract shows the empty message when no tables match', () => {
    render(
      <TableInventoryDesktopTable {...makeProps({ filteredTables: [], emptyMessage: 'Nothing here' })} />,
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('@contract renders a row per table with formatted party size, status, and availability', () => {
    render(
      <TableInventoryDesktopTable
        {...makeProps({
          filteredTables: [
            makeTable({ id: 'table-1', tableNumber: '1', minPartySize: 2, maxPartySize: 6 }),
            makeTable({
              id: 'table-2',
              tableNumber: '2',
              status: 'out_of_service',
              active: false,
            }),
            makeTable({ id: 'table-3', tableNumber: '3', zoneActive: false }),
          ],
        })}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(rows).toHaveLength(3);

    expect(within(rows[0]).getByText('2–6')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Active')).toBeInTheDocument();

    // Status enum values render with spaces instead of underscores.
    expect(within(rows[1]).getByText('out of service')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Inactive')).toBeInTheDocument();

    // Active table in an inactive zone is blocked by the zone.
    expect(within(rows[2]).getByText('Blocked by zone')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Zone off')).toBeInTheDocument();
  });

  it('@contract @a11y fires edit and delete callbacks with the row table', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryDesktopTable {...props} />);

    await user.click(screen.getByRole('button', { name: 'Edit table' }));
    expect(props.onEditTable).toHaveBeenCalledWith(props.filteredTables[0]);

    await user.click(screen.getByRole('button', { name: 'Delete table' }));
    expect(props.onDeleteTable).toHaveBeenCalledWith(props.filteredTables[0]);
  });

  it('@contract disables delete when the operator lacks permission or a delete is pending', () => {
    const { rerender } = render(
      <TableInventoryDesktopTable {...makeProps({ canDeleteTables: false })} />,
    );
    expect(screen.getByRole('button', { name: 'Delete table' })).toBeDisabled();

    rerender(<TableInventoryDesktopTable {...makeProps({ isDeletePending: true })} />);
    expect(screen.getByRole('button', { name: 'Delete table' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit table' })).toBeEnabled();
  });
});
