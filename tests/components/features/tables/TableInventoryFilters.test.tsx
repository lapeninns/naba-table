import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableInventoryFilters } from '@/components/features/tables/TableInventoryFilters';
import { ALL_ZONES_VALUE } from '@/components/features/tables/tableInventoryModel';

type FiltersProps = Parameters<typeof TableInventoryFilters>[0];

function makeProps(overrides: Partial<FiltersProps> = {}): FiltersProps {
  return {
    selectedZoneId: ALL_ZONES_VALUE,
    tableStatusFilter: 'active',
    zoneOptions: [
      { id: 'zone-main', name: 'Main', active: true },
      { id: 'zone-patio', name: 'Patio', active: false },
    ],
    onZoneFilterChange: vi.fn(),
    onTableStatusFilterChange: vi.fn(),
    ...overrides,
  };
}

describe('TableInventoryFilters', () => {
  it('@contract @a11y fires the zone filter callback with the chosen zone id', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryFilters {...props} />);

    await user.click(screen.getByLabelText('Zone'));
    await user.click(await screen.findByRole('option', { name: 'Main' }));

    expect(props.onZoneFilterChange).toHaveBeenCalledWith('zone-main');
  });

  it('@contract marks inactive zones in the filter options and supports the all-zones value', async () => {
    const user = userEvent.setup();
    const props = makeProps({ selectedZoneId: 'zone-main' });
    render(<TableInventoryFilters {...props} />);

    await user.click(screen.getByLabelText('Zone'));

    expect(await screen.findByRole('option', { name: 'Patio (inactive)' })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'All zones' }));
    expect(props.onZoneFilterChange).toHaveBeenCalledWith(ALL_ZONES_VALUE);
  });

  it('@contract @a11y fires the status filter callback with the chosen filter', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableInventoryFilters {...props} />);

    await user.click(screen.getByLabelText('Status'));
    await user.click(await screen.findByRole('option', { name: 'Inactive tables only' }));

    expect(props.onTableStatusFilterChange).toHaveBeenCalledWith('inactive');
  });

  it('@smoke explains the filter workflow to first-time operators', () => {
    render(<TableInventoryFilters {...makeProps()} />);

    expect(screen.getByText('Inventory filters')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add tables with number and capacity first; zones and classification can come later.',
      ),
    ).toBeInTheDocument();
  });
});
