import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';

import type { ManualAssignmentTable } from '@src/services/ops/bookings';

expect.extend({ toHaveNoViolations });

vi.mock('@/lib/analytics/emit', () => ({ emit: vi.fn() }));

// TableAssignmentPanel is intentionally tested with a mocked hook so this stays deterministic and fast.
vi.mock('@src/components/features/dashboard/booking-details/hooks/useTableAssignment', () => {
  const tables: ManualAssignmentTable[] = [
    {
      id: 't-1',
      tableNumber: '12',
      name: 'Window 12',
      capacity: 4,
      minPartySize: 1,
      maxPartySize: 6,
      section: 'Main',
      category: 'standard',
      seatingType: 'standard',
      mobility: 'standard',
      zoneId: 'zone-1',
      zoneActive: true,
      status: 'available',
      active: true,
      position: null,
    },
    {
      id: 't-2',
      tableNumber: '7',
      name: 'Booth 7',
      capacity: 2,
      minPartySize: 1,
      maxPartySize: 2,
      section: 'Booths',
      category: 'booth',
      seatingType: 'booth',
      mobility: 'standard',
      zoneId: 'zone-1',
      zoneActive: true,
      status: 'available',
      active: true,
      position: null,
    },
  ];

  return {
    useTableAssignment: () => ({
      context: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      tables,
      suggestedTables: [tables[0]],
      selectedTables: [],
      setSelectedTables: vi.fn(),
      selectedCapacity: 0,
      assignedCapacity: 0,
      assignedTableIds: new Set<string>(),
      conflictedTableIds: new Set<string>(),
      validation: {
        status: 'ok',
        warnings: [],
        errors: [],
        summary: { selectedCount: 0, selectedCapacity: 0, requiredCapacity: 4 },
        needsConfirmation: false,
      },
      apply: vi.fn(async () => ({ ok: true })),
      unassignAll: vi.fn(async () => ({ ok: true })),
      autoAssign: vi.fn(async () => ({ ok: true })),
      isAssigning: false,
      isUnassigning: false,
      isAutoAssigning: false,
      isPending: false,
    }),
  };
});

describe('TableAssignmentPanel accessibility', () => {
  it('has no axe violations and exposes a single-select fit control', async () => {
    const { TableAssignmentPanel } =
      await import('@src/components/features/dashboard/booking-details/components/TableAssignmentPanel');

    const { container } = render(
      <main>
        <TableAssignmentPanel
          bookingId="booking-1"
          restaurantId="rest-1"
          partySize={4}
          date="2026-02-10"
          currentAssignments={[]}
          onAssignmentComplete={vi.fn()}
          bookingStartTime="19:00"
          bookingEndTime="20:30"
        />
      </main>,
    );

    // ToggleGroup single-select should expose a radiogroup-like control with an accessible name.
    expect(screen.getByLabelText('Capacity fit filter')).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
