import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingsFilterBar } from '@/components/features/dashboard/BookingsFilterBar';

describe('BookingsFilterBar', () => {
  it('@contract renders every booking filter option with its accessible description', () => {
    render(<BookingsFilterBar value="all" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'All bookings' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Expected or pending arrivals' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Currently seated guests' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Bookings that need an action now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Completed, cancelled, or no-show bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Marked as no show' })).toBeInTheDocument();
  });

  it('@contract marks the active filter as selected', () => {
    render(<BookingsFilterBar value="seated" onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Currently seated guests' })).toHaveAttribute(
      'data-state',
      'on',
    );
    expect(screen.getByRole('radio', { name: 'All bookings' })).toHaveAttribute(
      'data-state',
      'off',
    );
  });

  it('@contract selecting another filter fires onChange with the filter value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BookingsFilterBar value="all" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Currently seated guests' }));

    expect(onChange).toHaveBeenCalledWith('seated');
  });

  it('@contract re-clicking the active filter does not fire onChange with an empty value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BookingsFilterBar value="all" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'All bookings' }));

    // Radix emits '' when deselecting a single toggle; the component guards it.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('@contract shows positive counts and hides zero counts', () => {
    render(
      <BookingsFilterBar
        value="all"
        onChange={vi.fn()}
        counts={{ all: 12, upcoming: 0, seated: 3 }}
      />,
    );

    expect(screen.getByRole('radio', { name: 'All bookings' })).toHaveTextContent('All12');
    expect(screen.getByRole('radio', { name: 'Currently seated guests' })).toHaveTextContent(
      'Seated3',
    );
    expect(screen.getByRole('radio', { name: 'Expected or pending arrivals' })).toHaveTextContent(
      /^Upcoming$/,
    );
  });
});
