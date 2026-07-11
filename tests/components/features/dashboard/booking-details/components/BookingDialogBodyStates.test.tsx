import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  BookingDialogEmptyState,
  BookingDialogErrorState,
  BookingDialogLoadingState,
} from '@/components/features/dashboard/booking-details/components/BookingDialogBodyStates';

describe('BookingDialogBodyStates', () => {
  it('@smoke loading state renders skeleton placeholders', () => {
    const { container } = render(<BookingDialogLoadingState />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it('@contract error state shows the message and wires retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<BookingDialogErrorState errorMessage="Network exploded" onRetry={onRetry} />);

    expect(screen.getByText('Unable to load booking')).toBeInTheDocument();
    expect(screen.getByText('Network exploded')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract error state omits retry without a handler', () => {
    render(<BookingDialogErrorState errorMessage="Network exploded" />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('@smoke empty state prompts for a booking selection', () => {
    render(<BookingDialogEmptyState />);

    expect(screen.getByText('No booking selected')).toBeInTheDocument();
    expect(screen.getByText('Select a booking to view details.')).toBeInTheDocument();
  });
});
