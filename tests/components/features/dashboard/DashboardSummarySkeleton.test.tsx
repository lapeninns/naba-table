import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSummarySkeleton } from '@/components/features/dashboard/DashboardSummarySkeleton';

describe('DashboardSummarySkeleton', () => {
  it('@smoke renders the bookings card shell with the restaurant name', () => {
    render(<DashboardSummarySkeleton restaurantName="Old Crown" />);

    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText(/Active reservations for Old Crown/)).toBeInTheDocument();
  });

  it('@smoke falls back to a generic name when restaurantName is missing or blank', () => {
    const { rerender } = render(<DashboardSummarySkeleton />);
    expect(screen.getByText(/Active reservations for your restaurant/)).toBeInTheDocument();

    rerender(<DashboardSummarySkeleton restaurantName="   " />);
    expect(screen.getByText(/Active reservations for your restaurant/)).toBeInTheDocument();
  });

  it('@smoke marks the placeholder card as busy', () => {
    const { container } = render(<DashboardSummarySkeleton restaurantName="Old Crown" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
