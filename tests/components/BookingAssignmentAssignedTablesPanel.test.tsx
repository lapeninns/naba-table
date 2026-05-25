import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingAssignmentAssignedTablesPanel } from '@/components/features/dashboard/booking-details/components/BookingAssignmentAssignedTablesPanel';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

function makeTable(
  overrides: Partial<ManualAssignmentTable> & { id: string },
): ManualAssignmentTable {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id.replace('t-', ''),
    name: overrides.name ?? `Table ${overrides.id}`,
    capacity: overrides.capacity ?? 4,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? 8,
    section: overrides.section ?? 'Main',
    category: overrides.category ?? 'standard',
    seatingType: overrides.seatingType ?? 'standard',
    mobility: overrides.mobility ?? 'standard',
    zoneId: overrides.zoneId ?? 'zone-main',
    zoneActive: overrides.zoneActive ?? true,
    status: overrides.status ?? 'available',
    active: overrides.active ?? true,
    position: overrides.position ?? null,
  } as ManualAssignmentTable;
}

describe('BookingAssignmentAssignedTablesPanel', () => {
  it('renders the empty assigned-table state', () => {
    render(
      <BookingAssignmentAssignedTablesPanel
        assignedTables={[]}
        canUnassignSingleTable
        onRequestUnassignTable={vi.fn()}
        onRemoveAllTables={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        'No tables assigned yet. Select tables on the left to match the party size.',
      ),
    ).toBeInTheDocument();
  });

  it('requests single-table removal from the card action', async () => {
    const user = userEvent.setup();
    const onRequestUnassignTable = vi.fn();

    render(
      <BookingAssignmentAssignedTablesPanel
        assignedTables={[makeTable({ id: 't-12', tableNumber: '12', capacity: 6 })]}
        canUnassignSingleTable
        onRequestUnassignTable={onRequestUnassignTable}
        onRemoveAllTables={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Currently assigned tables' })).toBeVisible();
    expect(screen.getByText('6 total seats')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove table 12 from booking' }));

    expect(onRequestUnassignTable).toHaveBeenCalledWith('t-12');
  });

  it('summarizes merged tables and requests bulk removal', async () => {
    const user = userEvent.setup();
    const onRemoveAllTables = vi.fn();

    render(
      <BookingAssignmentAssignedTablesPanel
        assignedTables={[
          makeTable({ id: 't-1', tableNumber: '1', capacity: 2 }),
          makeTable({ id: 't-2', tableNumber: '2', capacity: 4, section: 'Patio' }),
        ]}
        canUnassignSingleTable
        onRequestUnassignTable={vi.fn()}
        onRemoveAllTables={onRemoveAllTables}
      />,
    );

    expect(screen.getByText('6 total seats')).toBeVisible();
    expect(screen.getByText('2 tables')).toBeVisible();
    expect(screen.getByText('Merged tables:')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove all assigned tables' }));

    expect(onRemoveAllTables).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Remove table/ })).not.toBeInTheDocument();
  });
});
