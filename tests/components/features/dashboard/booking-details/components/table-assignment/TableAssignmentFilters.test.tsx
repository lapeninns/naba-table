import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableAssignmentFilters } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentFilters';

import type { TableAssignmentFiltersProps } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentFilters';

function makeProps(
  overrides: Partial<TableAssignmentFiltersProps> = {},
): TableAssignmentFiltersProps {
  return {
    zoneOptions: ['all', 'Main', 'Terrace'],
    zoneFilter: 'all',
    onZoneFilterChange: vi.fn(),
    sortBy: 'best',
    onSortByChange: vi.fn(),
    availabilityOnly: false,
    onAvailabilityOnlyChange: vi.fn(),
    fitFilter: 'all',
    onFitFilterChange: vi.fn(),
    onResetFilters: vi.fn(),
    ...overrides,
  };
}

describe('TableAssignmentFilters', () => {
  it('@contract picking a zone fires onZoneFilterChange', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentFilters {...props} />);

    await user.click(screen.getByRole('combobox', { name: 'Table zone filter' }));
    await user.click(await screen.findByRole('option', { name: 'Terrace' }));

    expect(props.onZoneFilterChange).toHaveBeenCalledWith('Terrace');
  });

  it('@contract picking a sort order fires onSortByChange', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentFilters {...props} />);

    await user.click(screen.getByRole('combobox', { name: 'Table sort order' }));
    await user.click(await screen.findByRole('option', { name: 'Capacity' }));

    expect(props.onSortByChange).toHaveBeenCalledWith('capacity');
  });

  it('@contract the availability switch reports its next state', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentFilters {...props} />);

    await user.click(screen.getByRole('switch', { name: 'Available Only' }));

    expect(props.onAvailabilityOnlyChange).toHaveBeenCalledWith(true);
  });

  it('@contract the fit toggle group selects a capacity fit and ignores deselection', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentFilters {...props} />);

    await user.click(screen.getByRole('radio', { name: 'Perfect' }));
    expect(props.onFitFilterChange).toHaveBeenCalledWith('perfect');

    // Clicking the active option would emit an empty value; the handler must swallow it.
    const active = makeProps({ fitFilter: 'perfect' });
    render(<TableAssignmentFilters {...active} />);
    await user.click(screen.getAllByRole('radio', { name: 'Perfect' }).at(-1)!);
    expect(active.onFitFilterChange).not.toHaveBeenCalled();
  });

  it('@contract reset fires onResetFilters', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentFilters {...props} />);

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(props.onResetFilters).toHaveBeenCalledTimes(1);
  });
});
