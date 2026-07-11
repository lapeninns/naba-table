import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsDashboardToolbar } from '@/components/features/dashboard/OpsDashboardToolbar';
import { getEmptyBookingTabCounts } from '@/components/features/dashboard/bookingFilters';

function renderToolbar(overrides: Partial<Parameters<typeof OpsDashboardToolbar>[0]> = {}) {
  const props = {
    filter: 'all' as const,
    tabCounts: getEmptyBookingTabCounts(),
    searchQuery: '',
    onFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onPrint: vi.fn(),
    sticky: false,
    ...overrides,
  };
  render(<OpsDashboardToolbar {...props} />);
  return props;
}

describe('OpsDashboardToolbar', () => {
  it('@contract @a11y renders search, print, and filter controls with accessible names', () => {
    renderToolbar();

    expect(screen.getByRole('searchbox', { name: 'Search guests' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print bookings' })).toBeInTheDocument();
    const filterButton = screen.getByRole('button', { name: 'Filter bookings' });
    expect(filterButton).toHaveAttribute('aria-controls', 'ops-bookings-filter-bar');
  });

  it('@contract typing in search fires onSearchChange and print button fires onPrint', async () => {
    const user = userEvent.setup();
    const props = renderToolbar();

    await user.type(screen.getByRole('searchbox', { name: 'Search guests' }), 'al');
    expect(props.onSearchChange).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Print bookings' }));
    expect(props.onPrint).toHaveBeenCalledTimes(1);
  });

  it('@contract shows the controlled search value and forwards filter selection', async () => {
    const user = userEvent.setup();
    const props = renderToolbar({ searchQuery: 'smith' });

    expect(screen.getByRole('searchbox', { name: 'Search guests' })).toHaveValue('smith');

    await user.click(screen.getByRole('radio', { name: 'Currently seated guests' }));
    expect(props.onFilterChange).toHaveBeenCalledWith('seated');
  });

  it('@contract the filter shortcut scrolls the filter bar into view', async () => {
    const user = userEvent.setup();
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scrollSpy.mockClear?.();
    renderToolbar();

    await user.click(screen.getByRole('button', { name: 'Filter bookings' }));

    expect(scrollSpy).toHaveBeenCalled();
  });
});
