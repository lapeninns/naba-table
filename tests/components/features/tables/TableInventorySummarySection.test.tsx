import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableInventorySummarySection } from '@/components/features/tables/TableInventorySummarySection';

import type { TableInventorySummaryCardDescriptor } from '@/components/features/tables/tableInventoryDisplayDomain';

const summaryCards: TableInventorySummaryCardDescriptor[] = [
  { key: 'ready', label: 'Service-ready tables', value: '2 tables', description: '8 covers' },
  { key: 'total', label: 'Total inventory', value: '3 tables' },
];

describe('TableInventorySummarySection', () => {
  it('@contract renders summary cards when descriptors are available', () => {
    render(<TableInventorySummarySection isActive summaryCards={summaryCards} />);

    expect(screen.getByText('Service-ready tables')).toBeInTheDocument();
    expect(screen.getByText('2 tables')).toBeInTheDocument();
    expect(screen.getByText('8 covers')).toBeInTheDocument();
    expect(screen.getByText('Total inventory')).toBeInTheDocument();
  });

  it('@contract shows skeleton placeholders while the summary is not loaded', () => {
    const { container } = render(<TableInventorySummarySection isActive summaryCards={null} />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(4);
    expect(screen.queryByText('Service-ready tables')).not.toBeInTheDocument();
  });

  it('@contract links to the availability and profile settings that shape capacity', () => {
    render(<TableInventorySummarySection isActive summaryCards={summaryCards} />);

    expect(screen.getByText('Capacity depends on setup nearby')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open availability' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/availability'),
    );
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/profile#profile-contact'),
    );
  });

  it('@contract hides the section when it is not the active workspace', () => {
    render(<TableInventorySummarySection isActive={false} summaryCards={summaryCards} />);

    expect(screen.getByText('Service-ready tables')).not.toBeVisible();
  });
});
