import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableAssignmentSummaryCard } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentSummaryCard';

import type { TableAssignmentSummaryCardProps } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentSummaryCard';

function makeProps(
  overrides: Partial<TableAssignmentSummaryCardProps> = {},
): TableAssignmentSummaryCardProps {
  return {
    partySize: 4,
    selectedCapacity: 0,
    assignedCapacity: 0,
    selectedCount: 0,
    assignedCount: 0,
    isPending: false,
    isApplyBlocked: false,
    isApplyDisabled: false,
    applyDisabledReason: null,
    onSmartAssign: vi.fn(),
    onClearSelected: vi.fn(),
    onResetAssigned: vi.fn(),
    onConfirmApply: vi.fn(),
    ...overrides,
  };
}

describe('TableAssignmentSummaryCard', () => {
  it('@contract shows covers, combined seated total, and the percentage until met', () => {
    render(<TableAssignmentSummaryCard {...makeProps({ selectedCapacity: 2 })} />);

    expect(screen.getByText('4 Covers')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('/4')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('@contract reports Met once selected plus assigned capacity covers the party', () => {
    render(
      <TableAssignmentSummaryCard
        {...makeProps({ selectedCapacity: 2, assignedCapacity: 2 })}
      />,
    );

    expect(screen.getByText('Met')).toBeInTheDocument();
  });

  it('@contract smart assign and apply fire their handlers', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableAssignmentSummaryCard {...props} />);

    await user.click(screen.getByRole('button', { name: /Smart/ }));
    expect(props.onSmartAssign).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Assign/ }));
    expect(props.onConfirmApply).toHaveBeenCalledTimes(1);
  });

  it('@contract disables apply and explains why when blocked', () => {
    render(
      <TableAssignmentSummaryCard
        {...makeProps({
          isApplyBlocked: true,
          isApplyDisabled: true,
          applyDisabledReason: 'Select at least one table first.',
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /Assign/ })).toBeDisabled();
    expect(screen.getByText('Select at least one table first.')).toBeInTheDocument();
  });

  it('@contract clear and reset appear only with counts and fire their handlers', async () => {
    const user = userEvent.setup();
    const hidden = makeProps();
    const { rerender } = render(<TableAssignmentSummaryCard {...hidden} />);

    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();

    const props = makeProps({ selectedCount: 2, assignedCount: 1 });
    rerender(<TableAssignmentSummaryCard {...props} />);

    await user.click(screen.getByRole('button', { name: 'Clear (2)' }));
    expect(props.onClearSelected).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Reset \(1\)/ }));
    expect(props.onResetAssigned).toHaveBeenCalledTimes(1);
  });
});
