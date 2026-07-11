import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectableTableCard } from '@/components/features/dashboard/booking-details/components/SelectableTableCard';

import { makeManualTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { SelectableTableCardProps } from '@/components/features/dashboard/booking-details/components/SelectableTableCard';

function makeProps(overrides: Partial<SelectableTableCardProps> = {}): SelectableTableCardProps {
  return {
    tableId: 'table-1',
    table: makeManualTable(),
    partySize: 4,
    isSelected: false,
    isAssigned: false,
    isConflicted: false,
    onToggle: vi.fn(),
    disabled: false,
    ...overrides,
  };
}

describe('SelectableTableCard', () => {
  it('@contract renders table number, section, capacity, and the fit badge', () => {
    render(<SelectableTableCard {...makeProps()} />);

    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    // capacity 4 for a party of 4 → exact fit.
    expect(screen.getByText('Exact fit')).toBeInTheDocument();
  });

  it('@contract toggles selection with its table id and reflects aria-pressed', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<SelectableTableCard {...makeProps({ onToggle })} />);

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-pressed', 'false');

    await user.click(card);
    expect(onToggle).toHaveBeenCalledWith('table-1');

    rerender(<SelectableTableCard {...makeProps({ onToggle, isSelected: true })} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('@contract disables occupied tables and marks conflicts as busy', () => {
    render(
      <SelectableTableCard
        {...makeProps({ isConflicted: true, table: makeManualTable({ status: 'conflicted' }) })}
      />,
    );

    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('@contract disables already-assigned tables', () => {
    render(<SelectableTableCard {...makeProps({ isAssigned: true })} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('@contract flags undersized tables for large parties', () => {
    render(<SelectableTableCard {...makeProps({ partySize: 10 })} />);

    // maxPartySize 6 < party of 10 → too small.
    expect(screen.getByText('Too small')).toBeInTheDocument();
  });

  it('@contract exposes the screen-reader summary when described', () => {
    render(<SelectableTableCard {...makeProps({ describedById: 'sr-table-1' })} />);

    expect(screen.getByText(/Table T1\. 4 seats\. Section Main\./)).toBeInTheDocument();
    expect(screen.getByText(/Available\.$/)).toBeInTheDocument();
  });
});
