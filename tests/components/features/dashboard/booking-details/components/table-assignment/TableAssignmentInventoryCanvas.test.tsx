import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TableAssignmentInventoryCanvas } from '@/components/features/dashboard/booking-details/components/table-assignment/TableAssignmentInventoryCanvas';

import { makeManualTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { TableAssignmentTimeline } from '@/components/features/dashboard/booking-details/tableAssignmentPanelDomain';

const timeline: TableAssignmentTimeline = {
  bookingStart: '18:00',
  bookingEnd: '19:30',
  windowStart: '17:00',
  windowEnd: '22:00',
  parsedBookingStart: 18 * 60,
  parsedBookingEnd: 19 * 60 + 30,
  parsedWindowStart: 17 * 60,
  parsedWindowEnd: 22 * 60,
};

describe('TableAssignmentInventoryCanvas', () => {
  it('@contract renders the inventory heading with suggested and full sections', () => {
    const suggested = makeManualTable({ id: 'sug-1', tableNumber: 'S1' });
    const inventory = makeManualTable({ id: 'inv-1', tableNumber: 'A1' });

    render(
      <TableAssignmentInventoryCanvas
        assignedTableIds={new Set()}
        conflictedTableIds={new Set()}
        disabled={false}
        filteredTables={[inventory]}
        groupedTables={new Map([['Main', [inventory]]])}
        onToggle={vi.fn()}
        partySize={4}
        selectedTableIds={new Set()}
        suggestedTables={[suggested]}
        timeline={timeline}
      />,
    );

    expect(screen.getByText('Table Inventory')).toBeInTheDocument();
    expect(screen.getByText('Best Matches')).toBeInTheDocument();
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('Full Inventory')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('@contract omits the suggested section when there are no matches', () => {
    render(
      <TableAssignmentInventoryCanvas
        assignedTableIds={new Set()}
        conflictedTableIds={new Set()}
        disabled={false}
        filteredTables={[]}
        groupedTables={new Map()}
        onToggle={vi.fn()}
        partySize={4}
        selectedTableIds={new Set()}
        suggestedTables={[]}
        timeline={timeline}
      />,
    );

    expect(screen.queryByText('Best Matches')).not.toBeInTheDocument();
    expect(screen.getByText(/No tables match the current filters/)).toBeInTheDocument();
  });
});
