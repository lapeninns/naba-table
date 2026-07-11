import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryConfirmDialogs } from '@/components/features/tables/TableInventoryConfirmDialogs';

import type { TableInventory } from '@/services/ops/tables';

const tableTarget = {
  id: 'table-1',
  tableNumber: '12',
} as TableInventory;

const zoneTarget = { id: 'zone-1', name: 'Patio', active: true, sortOrder: 0 };

type ConfirmProps = Parameters<typeof TableInventoryConfirmDialogs>[0];

function makeProps(overrides: Partial<ConfirmProps> = {}): ConfirmProps {
  return {
    tableDeleteTarget: null,
    zoneDeleteTarget: null,
    isTableDeletePending: false,
    isZoneDeletePending: false,
    onTableOpenChange: vi.fn(),
    onZoneOpenChange: vi.fn(),
    onConfirmTableDelete: vi.fn(),
    onConfirmZoneDelete: vi.fn(),
    ...overrides,
  };
}

describe('TableInventoryConfirmDialogs', () => {
  it('@contract keeps both dialogs closed without delete targets', () => {
    render(<TableInventoryConfirmDialogs {...makeProps()} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract @a11y confirms table deletion with the table number in the warning copy', async () => {
    const user = userEvent.setup();
    const props = makeProps({ tableDeleteTarget: tableTarget });
    render(<TableInventoryConfirmDialogs {...props} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete table?');
    expect(dialog).toHaveTextContent(
      'Table 12 will be removed from inventory and can no longer be assigned to bookings. This cannot be undone.',
    );

    await user.click(screen.getByRole('button', { name: 'Delete table' }));
    expect(props.onConfirmTableDelete).toHaveBeenCalledTimes(1);
  });

  it('@contract cancels table deletion without firing the delete callback', async () => {
    const user = userEvent.setup();
    const props = makeProps({ tableDeleteTarget: tableTarget });
    render(<TableInventoryConfirmDialogs {...props} />);

    await user.click(screen.getByRole('button', { name: 'Keep table' }));

    expect(props.onConfirmTableDelete).not.toHaveBeenCalled();
    expect(props.onTableOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract shows a pending label while the table delete mutation runs', () => {
    render(
      <TableInventoryConfirmDialogs
        {...makeProps({ tableDeleteTarget: tableTarget, isTableDeletePending: true })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeInTheDocument();
  });

  it('@contract @a11y confirms zone deletion with the zone name in the warning copy', async () => {
    const user = userEvent.setup();
    const props = makeProps({ zoneDeleteTarget: zoneTarget });
    render(<TableInventoryConfirmDialogs {...props} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete zone?');
    expect(dialog).toHaveTextContent(
      'Patio will be removed from the floor-plan groups. This cannot be undone.',
    );

    await user.click(screen.getByRole('button', { name: 'Delete zone' }));
    expect(props.onConfirmZoneDelete).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Keep zone' }));
    expect(props.onZoneOpenChange).toHaveBeenCalledWith(false);
  });
});
