import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableTimelineSidePanels } from '@/components/features/tables/timeline/TableTimelineSidePanels';

describe('TableTimelineSidePanels (presentational)', () => {
  it('@smoke renders the action-required panel with its disabled notifications button', () => {
    render(<TableTimelineSidePanels />);

    expect(screen.getByText('Action Required')).toBeInTheDocument();
    expect(screen.getByText('Alerts will appear here once live data is loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View All Notifications' })).toBeDisabled();
  });

  it('@smoke renders the capacity breakdown rows with placeholder totals', () => {
    render(<TableTimelineSidePanels />);

    expect(screen.getByText('Capacity Breakdown')).toBeInTheDocument();
    expect(screen.getByText('2-Tops')).toBeInTheDocument();
    expect(screen.getByText('4-Tops')).toBeInTheDocument();
    expect(screen.getByText('6+ Tops')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
