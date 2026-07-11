import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryDialogs } from '@/components/features/tables/TableInventoryDialogs';

import type { TableInventory } from '@/services/ops/tables';

const zoneOptions = [{ id: 'zone-main', name: 'Main', active: true }];

type DialogsProps = Parameters<typeof TableInventoryDialogs>[0];

function makeProps(overrides: Partial<DialogsProps> = {}): DialogsProps {
  return {
    editingTable: null,
    editingZone: null,
    isDialogOpen: false,
    isFirstTable: false,
    isSavingTable: false,
    isSavingZone: false,
    isTableDeletePending: false,
    isZoneDeletePending: false,
    isZoneDialogOpen: false,
    isZonesLoading: false,
    onConfirmTableDelete: vi.fn(),
    onConfirmZoneDelete: vi.fn(),
    onTableDeleteOpenChange: vi.fn(),
    onTableDialogOpenChange: vi.fn(),
    onTableSubmit: vi.fn(),
    onZoneDeleteOpenChange: vi.fn(),
    onZoneDialogOpenChange: vi.fn(),
    onZoneSubmit: vi.fn(),
    tableDeleteTarget: null,
    zoneDeleteTarget: null,
    zoneOptions,
    ...overrides,
  };
}

describe('TableInventoryDialogs', () => {
  it('@contract renders no dialogs while everything is closed', () => {
    render(<TableInventoryDialogs {...makeProps()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract opens the table form dialog and forwards submissions', async () => {
    const user = userEvent.setup();
    const props = makeProps({ isDialogOpen: true });
    render(<TableInventoryDialogs {...props} />);

    expect(screen.getByRole('heading', { name: 'Add new table' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Table number *'), '3');
    // Pick the zone explicitly: the effect-driven default zone draft is not
    // observable under jsdom (see the note in TableInventoryForm.test.tsx).
    await user.click(screen.getByLabelText('Zone'));
    await user.click(await screen.findByRole('option', { name: 'Main' }));
    await user.click(screen.getByRole('button', { name: 'Save table' }));

    expect(props.onTableSubmit).toHaveBeenCalledTimes(1);
    expect(props.onTableSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tableNumber: '3', zoneId: 'zone-main' }),
    );
  });

  it('@contract closes the table dialog through the form cancel button', async () => {
    const user = userEvent.setup();
    const props = makeProps({ isDialogOpen: true });
    render(<TableInventoryDialogs {...props} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onTableDialogOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract opens the zone dialog and forwards zone submissions', async () => {
    const user = userEvent.setup();
    const props = makeProps({ isZoneDialogOpen: true });
    render(<TableInventoryDialogs {...props} />);

    expect(screen.getByRole('heading', { name: 'Add zone' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Zone name *'), 'Terrace');
    await user.click(screen.getByRole('button', { name: 'Save zone' }));

    expect(props.onZoneSubmit).toHaveBeenCalledWith({ name: 'Terrace', sortOrder: 0 });
  });

  it('@contract opens the delete confirmations from their targets', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      tableDeleteTarget: { id: 'table-1', tableNumber: '4' } as TableInventory,
    });
    const { unmount } = render(<TableInventoryDialogs {...props} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete table?');
    await user.click(screen.getByRole('button', { name: 'Delete table' }));
    expect(props.onConfirmTableDelete).toHaveBeenCalledTimes(1);
    unmount();

    const zoneProps = makeProps({
      zoneDeleteTarget: { id: 'zone-2', name: 'Bar', active: true, sortOrder: 1 },
    });
    render(<TableInventoryDialogs {...zoneProps} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete zone?');
    await user.click(screen.getByRole('button', { name: 'Delete zone' }));
    expect(zoneProps.onConfirmZoneDelete).toHaveBeenCalledTimes(1);
  });
});
