import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  TableAssignmentEmptyState,
  TableAssignmentErrorState,
  TableAssignmentLoadingState,
} from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentPanelStateViews';

describe('TableAssignmentPanelStateViews', () => {
  it('@smoke loading state renders skeleton placeholders', () => {
    const { container } = render(<TableAssignmentLoadingState />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(4);
  });

  it('@contract error state shows the Error message and wires retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<TableAssignmentErrorState error={new Error('Tables API down')} onRetry={onRetry} />);

    expect(screen.getByText('Unable to load tables')).toBeInTheDocument();
    expect(screen.getByText('Tables API down')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract error state falls back to generic copy for non-Error values', () => {
    render(<TableAssignmentErrorState error="string failure" onRetry={vi.fn()} />);

    expect(screen.getByText('Failed to load tables.')).toBeInTheDocument();
  });

  it('@smoke empty state suggests adjusting the booking', () => {
    render(<TableAssignmentEmptyState />);

    expect(screen.getByText('No tables available right now.')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting the booking time or split the party.'),
    ).toBeInTheDocument();
  });
});
