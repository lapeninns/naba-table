import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AssignmentToolbar } from '@/components/features/dashboard/manual-assignment/AssignmentToolbar';

type ToolbarProps = Parameters<typeof AssignmentToolbar>[0];

function makeProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    selectedCount: 2,
    selectedCapacity: 6,
    partySize: 4,
    zoneId: null,
    validationChecks: [],
    onAssign: vi.fn(),
    onClear: vi.fn(),
    isPending: false,
    isAssigning: false,
    canAssign: true,
    ...overrides,
  };
}

describe('AssignmentToolbar', () => {
  it('@contract shows party, selection, and surplus capacity stats', () => {
    render(<AssignmentToolbar {...makeProps()} />);

    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('tables')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('+2 seats')).toBeInTheDocument();
  });

  it('@contract singularizes the table label and flags a capacity shortfall', () => {
    render(
      <AssignmentToolbar
        {...makeProps({ selectedCount: 1, selectedCapacity: 3, partySize: 4 })}
      />,
    );

    expect(screen.getByText('table')).toBeInTheDocument();
    expect(screen.getByText('-1 seat')).toBeInTheDocument();
  });

  it('@contract renders the zone badge when a zone is locked in', () => {
    render(<AssignmentToolbar {...makeProps({ zoneId: 'zone-terrace' })} />);

    expect(screen.getByText(/Zone: zone-terrace/)).toBeInTheDocument();
  });

  it('@contract fires onAssign from the primary action', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<AssignmentToolbar {...props} />);

    await user.click(screen.getByRole('button', { name: 'Assign tables to booking instantly' }));

    expect(props.onAssign).toHaveBeenCalledTimes(1);
  });

  it('@contract disables assignment and exposes the reason as the accessible name', () => {
    render(
      <AssignmentToolbar
        {...makeProps({ canAssign: false, assignDisabledReason: 'Select at least one table' })}
      />,
    );

    const button = screen.getByRole('button', { name: 'Select at least one table' });
    expect(button).toBeDisabled();
  });

  it('@contract shows the assigning spinner state', () => {
    render(<AssignmentToolbar {...makeProps({ isAssigning: true })} />);

    expect(screen.getByText('Assigning…')).toBeInTheDocument();
  });

  it('@contract clear button appears only with a selection and fires onClear', async () => {
    const user = userEvent.setup();
    const props = makeProps({ selectedCount: 0 });
    const { rerender } = render(<AssignmentToolbar {...props} />);

    expect(
      screen.queryByRole('button', { name: 'Clear table selection' }),
    ).not.toBeInTheDocument();

    const withSelection = makeProps({ selectedCount: 2 });
    rerender(<AssignmentToolbar {...withSelection} />);
    await user.click(screen.getByRole('button', { name: 'Clear table selection' }));

    expect(withSelection.onClear).toHaveBeenCalledTimes(1);
  });

  it('@contract toggles the available-only switch', async () => {
    const user = userEvent.setup();
    const onOnlyAvailableChange = vi.fn();
    render(
      <AssignmentToolbar {...makeProps({ onlyAvailable: false, onOnlyAvailableChange })} />,
    );

    await user.click(screen.getByRole('switch', { name: 'Show only available tables' }));

    expect(onOnlyAvailableChange).toHaveBeenCalledWith(true);
  });
});
