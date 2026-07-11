import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SuggestedTablesSection } from '@/components/features/dashboard/booking-details/components/table-assignment/SuggestedTablesSection';

import { makeManualTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { SuggestedTablesSectionProps } from '@/components/features/dashboard/booking-details/components/table-assignment/SuggestedTablesSection';

function makeProps(
  overrides: Partial<SuggestedTablesSectionProps> = {},
): SuggestedTablesSectionProps {
  return {
    tables: [makeManualTable()],
    partySize: 4,
    selectedTableIds: new Set<string>(),
    assignedTableIds: new Set<string>(),
    conflictedTableIds: new Set<string>(),
    disabled: false,
    onToggle: vi.fn(),
    ...overrides,
  };
}

describe('SuggestedTablesSection', () => {
  it('@contract renders nothing without suggestions', () => {
    const { container } = render(<SuggestedTablesSection {...makeProps({ tables: [] })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract renders the Best Matches header with suggestion cards', () => {
    render(<SuggestedTablesSection {...makeProps()} />);

    expect(screen.getByText('Best Matches')).toBeInTheDocument();
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('@contract caps the section at six suggestions', () => {
    const tables = Array.from({ length: 8 }, (_, index) =>
      makeManualTable({ id: `table-${index}`, tableNumber: `T${index}` }),
    );
    render(<SuggestedTablesSection {...makeProps({ tables })} />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
    expect(screen.queryByText('T6')).not.toBeInTheDocument();
  });

  it('@contract toggling a suggested table reports its id', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<SuggestedTablesSection {...makeProps({ onToggle })} />);

    await user.click(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledWith('table-1');
  });
});
