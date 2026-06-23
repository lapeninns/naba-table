import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FloorPlanCockpit } from '@/components/features/floor-plan/FloorPlanCockpit';
import type { FloorPlanStats } from '@/components/features/floor-plan/useFloorPlanState';

const stats: FloorPlanStats = {
  seatedCovers: 28,
  bookedCovers: 10,
  bookedTables: 2,
  openTables: 4,
  capacity: 46,
  totalTables: 13,
  zoneCount: 3,
  occupancyPct: 61,
};

describe('FloorPlanCockpit', () => {
  it('groups the stat tiles under an accessible service summary', () => {
    render(<FloorPlanCockpit stats={stats} />);
    expect(screen.getByRole('group', { name: /service summary/i })).toBeInTheDocument();
  });

  it('ties each stat number to its label and detail in one accessible group', () => {
    render(<FloorPlanCockpit stats={stats} />);
    const summary = screen.getByRole('group', { name: /service summary/i });

    const seated = within(summary).getByRole('group', { name: 'Covers seated' });
    expect(within(seated).getByText('28')).toBeInTheDocument();
    expect(within(seated).getByText('of 46 · 61% capacity')).toBeInTheDocument();

    expect(within(summary).getByRole('group', { name: 'Booked ahead' })).toBeInTheDocument();
    expect(within(summary).getByRole('group', { name: 'Tables open' })).toBeInTheDocument();
  });

  it('lays the metrics out as a compact 3-up strip (not stacked) so the map stays near the top', () => {
    render(<FloorPlanCockpit stats={stats} />);
    const summary = screen.getByRole('group', { name: /service summary/i });
    expect(summary.className).toContain('grid-cols-3');
    expect(summary.className).not.toContain('grid-cols-1');
    // The detail stays in the accessibility tree on mobile even though it is visually sr-only.
    const detail = within(summary).getByText('of 46 · 61% capacity');
    expect(detail.className).toContain('sr-only');
    expect(detail.className).toContain('sm:not-sr-only');
  });
});
