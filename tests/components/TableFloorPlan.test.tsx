import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableFloorPlan } from '@/components/features/dashboard/TableFloorPlan';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

describe('TableFloorPlan', () => {
  it('renders unpositioned tables and toggles an available table', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TableFloorPlan
        bookingId="booking-1"
        tables={[makeTable({ id: 't-1', tableNumber: '12', name: 'Window' })]}
        holds={[]}
        conflicts={[]}
        bookingAssignments={[]}
        selectedTableIds={[]}
        onToggle={onToggle}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Table 12, Window, 4 seats/ }));

    expect(onToggle).toHaveBeenCalledWith('t-1');
  });

  it('keeps held tables unavailable in the rendered list', () => {
    render(
      <TableFloorPlan
        bookingId="booking-1"
        tables={[makeTable({ id: 't-2', tableNumber: '8' })]}
        holds={[
          {
            bookingId: 'booking-2',
            countdownSeconds: null,
            createdBy: null,
            createdByEmail: null,
            createdByName: 'Alex',
            endAt: '2026-05-20T20:00:00.000Z',
            expiresAt: '2026-05-20T19:45:00.000Z',
            id: 'hold-1',
            metadata: null,
            restaurantId: 'restaurant-1',
            startAt: '2026-05-20T19:00:00.000Z',
            tableIds: ['t-2'],
            zoneId: 'zone-main',
          },
        ]}
        conflicts={[]}
        bookingAssignments={[]}
        selectedTableIds={[]}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Table 8, 4 seats, unavailable, held/ }),
    ).toBeDisabled();
  });
});

function makeTable(
  overrides: Partial<ManualAssignmentTable> & { id: string },
): ManualAssignmentTable {
  return {
    active: overrides.active ?? true,
    capacity: overrides.capacity ?? 4,
    category: overrides.category ?? 'standard',
    id: overrides.id,
    maxPartySize: overrides.maxPartySize ?? 8,
    minPartySize: overrides.minPartySize ?? 1,
    mobility: overrides.mobility ?? 'standard',
    name: overrides.name ?? null,
    position: overrides.position ?? null,
    seatingType: overrides.seatingType ?? 'standard',
    section: overrides.section ?? 'Main',
    status: overrides.status ?? 'available',
    tableNumber: overrides.tableNumber ?? overrides.id,
    zoneActive: overrides.zoneActive ?? true,
    zoneId: overrides.zoneId ?? 'zone-main',
  };
}
