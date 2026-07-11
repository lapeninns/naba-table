import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableInventoryCapacityFields } from '@/components/features/tables/TableInventoryCapacityFields';

import type { TableInventory } from '@/services/ops/tables';

function makeTable(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '12',
    capacity: 6,
    minPartySize: 2,
    maxPartySize: 8,
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

describe('TableInventoryCapacityFields (presentational)', () => {
  it('@smoke @a11y renders labelled inputs with sensible defaults for a new table', () => {
    render(<TableInventoryCapacityFields table={null} />);

    expect(screen.getByText('Capacity')).toBeInTheDocument();
    expect(screen.getByLabelText('Table number *')).toHaveValue('');
    expect(screen.getByLabelText('Capacity *')).toHaveValue(4);
    expect(screen.getByLabelText('Min party size')).toHaveValue(1);
    expect(screen.getByLabelText('Max party size')).toHaveValue(null);
    expect(screen.getByPlaceholderText('Same as capacity')).toBeInTheDocument();
  });

  it('@smoke @a11y prefills inputs from an existing table', () => {
    render(<TableInventoryCapacityFields table={makeTable()} />);

    expect(screen.getByLabelText('Table number *')).toHaveValue('12');
    expect(screen.getByLabelText('Capacity *')).toHaveValue(6);
    expect(screen.getByLabelText('Min party size')).toHaveValue(2);
    expect(screen.getByLabelText('Max party size')).toHaveValue(8);
  });
});
