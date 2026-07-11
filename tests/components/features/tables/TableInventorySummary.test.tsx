import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SummaryCard } from '@/components/features/tables/TableInventorySummary';

describe('TableInventorySummary SummaryCard (presentational)', () => {
  it('@smoke renders label, value, and description', () => {
    render(<SummaryCard label="Bookable tables" value="12 tables" description="Across 3 zones" />);

    expect(screen.getByText('Bookable tables')).toBeInTheDocument();
    expect(screen.getByText('12 tables')).toBeInTheDocument();
    expect(screen.getByText('Across 3 zones')).toBeInTheDocument();
  });

  it('@smoke renders numeric values and omits the description when absent', () => {
    render(<SummaryCard label="Total covers" value={48} />);

    expect(screen.getByText('Total covers')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.queryByText('Across 3 zones')).not.toBeInTheDocument();
  });
});
