import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryConfirmDialogs } from '@/components/features/tables/TableInventoryConfirmDialogs';

import type { TableInventory } from '@/services/ops/tables';

type ConfirmProps = Parameters<typeof TableInventoryConfirmDialogs>[0];

const zone = { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 };

function makeTable(): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '12',
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
  };
}

function renderDialogs(overrides: Partial<ConfirmProps> = {}) {
  const props: ConfirmProps = {
    tableDeleteTarget: null,
    zoneDeleteTarget: null,
    zoneWithTables: null,
    isTableDeletePending: false,
    isZoneDeletePending: false,
    onTableOpenChange: vi.fn(),
    onZoneOpenChange: vi.fn(),
    onZoneWithTablesOpenChange: vi.fn(),
    onConfirmTableDelete: vi.fn(),
    onConfirmZoneDelete: vi.fn(),
    onShowZoneTables: vi.fn(),
    ...overrides,
  };
  render(<TableInventoryConfirmDialogs {...props} />);
  return props;
}

describe('TableInventoryConfirmDialogs', () => {
  it('names the effect of deleting a table and offers turning it off instead', async () => {
    const user = userEvent.setup();
    const props = renderDialogs({ tableDeleteTarget: makeTable() });

    const dialog = screen.getByRole('alertdialog', { name: 'Delete table 12?' });
    expect(
      within(dialog).getByText(
        'It can no longer be given to bookings. This can’t be undone. To keep it for later, turn it off instead.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete table' }));
    expect(props.onConfirmTableDelete).toHaveBeenCalledTimes(1);
  });

  it('confirms deleting an empty zone', async () => {
    const user = userEvent.setup();
    const props = renderDialogs({ zoneDeleteTarget: zone });

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Main?' });
    expect(
      within(dialog).getByText('The zone has no tables. This can’t be undone.'),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete zone' }));
    expect(props.onConfirmZoneDelete).toHaveBeenCalledTimes(1);
  });

  it('explains why a zone with tables cannot be deleted and shows its tables', async () => {
    const user = userEvent.setup();
    const props = renderDialogs({ zoneWithTables: { zone, tableCount: 3 } });

    const dialog = screen.getByRole('alertdialog', { name: 'Main still has tables' });
    expect(
      within(dialog).getByText(
        'Move or delete its 3 tables before deleting the zone. To stop bookings for now, take the zone out of service instead.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Show its tables' }));
    expect(props.onShowZoneTables).toHaveBeenCalledWith('zone-main');
  });
});
