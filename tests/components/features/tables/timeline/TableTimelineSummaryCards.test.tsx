import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableTimelineSummaryCards } from '@/components/features/tables/timeline/TableTimelineSummaryCards';

describe('TableTimelineSummaryCards (presentational)', () => {
  it('@smoke renders the four capacity summary placeholders', () => {
    render(<TableTimelineSummaryCards />);

    expect(screen.getByText('Current Occupancy')).toBeInTheDocument();
    expect(screen.getByText('Avg. Turn Time')).toBeInTheDocument();
    expect(screen.getByText('Upcoming Arrivals')).toBeInTheDocument();
    expect(screen.getByText('Table Conflicts')).toBeInTheDocument();
    // Placeholder values render until live data wiring lands.
    expect(screen.getAllByText('—')).toHaveLength(4);
  });
});
