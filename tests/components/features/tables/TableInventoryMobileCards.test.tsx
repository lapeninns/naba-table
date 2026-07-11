import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryMobileCards } from '@/components/features/tables/TableInventoryMobileCards';

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

type CardsProps = Parameters<typeof TableInventoryMobileCards>[0];

function makeProps(overrides: Partial<CardsProps> = {}): CardsProps {
  return {
    isLoading: false,
    canDeleteTables: true,
    isDeletePending: false,
    emptyMessage: 'No tables yet.',
    filteredTables: [makeTable({ id: 'table-7', tableNumber: '7' })],
    onEditTable: vi.fn(),
    onDeleteTable: vi.fn(),
    ...overrides,
  };
}

describe('TableInventoryMobileCards', () => {
  it('@contract shows the loading placeholder while tables load', () => {
    render(<TableInventoryMobileCards {...makeProps({ isLoading: true })} />);

    expect(screen.getByText('Loading tables…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });

  it('@contract shows the empty message when there are no tables', () => {
    render(<TableInventoryMobileCards {...makeProps({ filteredTables: [] })} />);

    expect(screen.getByText('No tables yet.')).toBeInTheDocument();
  });

  it('@contract renders a card per table with zone, covers, and availability facts', () => {
    render(
      <TableInventoryMobileCards
        {...makeProps({
          filteredTables: [
            makeTable({
              id: 'table-7',
              tableNumber: '7',
              capacity: 6,
              minPartySize: 2,
              maxPartySize: null,
              zoneName: 'Patio',
              zoneActive: false,
            }),
          ],
        })}
      />,
    );

    const card = screen.getByRole('article');
    expect(within(card).getByRole('heading', { name: 'Table 7' })).toBeInTheDocument();
    expect(within(card).getByText('Patio · 6 covers')).toBeInTheDocument();
    // Open-ended party range renders as "min+".
    expect(within(card).getByText('2+')).toBeInTheDocument();
    expect(within(card).getByText('Blocked by zone')).toBeInTheDocument();
  });

  it('@contract fires edit and delete callbacks with the card table', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryMobileCards {...props} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(props.onEditTable).toHaveBeenCalledWith(props.filteredTables[0]);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onDeleteTable).toHaveBeenCalledWith(props.filteredTables[0]);
  });

  it('@contract disables delete without permission while keeping edit available', () => {
    render(<TableInventoryMobileCards {...makeProps({ canDeleteTables: false })} />);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
  });
});
