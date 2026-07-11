import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableAssignmentConfirmDialogs } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentConfirmDialogs';

import type { TableAssignmentConfirmDialogsProps } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentConfirmDialogs';

function makeProps(
  overrides: Partial<TableAssignmentConfirmDialogsProps> = {},
): TableAssignmentConfirmDialogsProps {
  return {
    confirmApplyOpen: false,
    onConfirmApplyOpenChange: vi.fn(),
    selectedTableCount: 2,
    partySize: 4,
    warnings: [],
    onConfirmApply: vi.fn(),
    confirmUnassignOpen: false,
    onConfirmUnassignOpenChange: vi.fn(),
    onConfirmUnassign: vi.fn(),
    ...overrides,
  };
}

describe('TableAssignmentConfirmDialogs', () => {
  it('@contract renders neither dialog while closed', () => {
    render(<TableAssignmentConfirmDialogs {...makeProps()} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract the apply dialog pluralizes tables and confirms the assignment', async () => {
    const user = userEvent.setup();
    const props = makeProps({ confirmApplyOpen: true });
    render(<TableAssignmentConfirmDialogs {...props} />);

    expect(
      screen.getByRole('alertdialog', { name: 'Confirm table assignment' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/assign 2 tables for 4 covers/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm assignment' }));
    expect(props.onConfirmApply).toHaveBeenCalledTimes(1);
  });

  it('@contract the apply dialog singularizes one table and lists warnings', () => {
    render(
      <TableAssignmentConfirmDialogs
        {...makeProps({
          confirmApplyOpen: true,
          selectedTableCount: 1,
          warnings: ['Tables span multiple zones'],
        })}
      />,
    );

    expect(screen.getByText(/assign 1 table for 4 covers/)).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Tables span multiple zones')).toBeInTheDocument();
  });

  it('@contract the unassign dialog confirms removal and cancel closes it', async () => {
    const user = userEvent.setup();
    const props = makeProps({ confirmUnassignOpen: true });
    render(<TableAssignmentConfirmDialogs {...props} />);

    expect(
      screen.getByRole('alertdialog', { name: 'Remove assigned tables?' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove tables' }));
    expect(props.onConfirmUnassign).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onConfirmUnassignOpenChange).toHaveBeenCalledWith(false);
  });
});
