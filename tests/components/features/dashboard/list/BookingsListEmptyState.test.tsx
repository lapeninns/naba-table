import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BookingsListEmptyState } from '@/components/features/dashboard/list/BookingsListEmptyState';

describe('BookingsListEmptyState', () => {
  it('@smoke renders the no-results copy', () => {
    render(<BookingsListEmptyState />);

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filters to see more results.')).toBeInTheDocument();
  });
});
