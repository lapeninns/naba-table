import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AllTablesConflictBadge,
  AllTablesEmptyState,
  AllTablesInventoryHeader,
  AllTablesInventoryShell,
} from '@/components/features/dashboard/booking-details/components/table-assignment/AllTablesInventoryChrome';

describe('AllTablesInventoryChrome', () => {
  it('@smoke shell wraps its children in the inventory section', () => {
    render(
      <AllTablesInventoryShell>
        <p>Inventory body</p>
      </AllTablesInventoryShell>,
    );

    expect(screen.getByText('Inventory body')).toBeInTheDocument();
  });

  it('@smoke header shows the total table count', () => {
    render(<AllTablesInventoryHeader totalCount={12} />);

    expect(screen.getByText('Full Inventory')).toBeInTheDocument();
    expect(screen.getByText('12 tables')).toBeInTheDocument();
  });

  it('@smoke empty state suggests widening the filters', () => {
    render(<AllTablesEmptyState />);

    expect(
      screen.getByText(/No tables match the current filters/),
    ).toBeInTheDocument();
  });

  it('@contract conflict badge pluralizes and hides at zero', () => {
    const { rerender, container } = render(<AllTablesConflictBadge count={0} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<AllTablesConflictBadge count={1} />);
    expect(screen.getByText('1 conflict')).toBeInTheDocument();

    rerender(<AllTablesConflictBadge count={3} />);
    expect(screen.getByText('3 conflicts')).toBeInTheDocument();
  });
});
