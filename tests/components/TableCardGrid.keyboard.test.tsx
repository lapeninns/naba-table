import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableCardGrid } from '@/components/features/dashboard/booking-details/components/table-assignment/TableCardGrid';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

function makeTable(overrides: Partial<ManualAssignmentTable> & { id: string }): ManualAssignmentTable {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id.replace('t-', ''),
    name: overrides.name ?? `Table ${overrides.id}`,
    capacity: overrides.capacity ?? 4,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? 8,
    section: overrides.section ?? 'Main',
    category: overrides.category ?? 'standard',
    seatingType: overrides.seatingType ?? 'standard',
    mobility: overrides.mobility ?? 'standard',
    zoneId: overrides.zoneId ?? 'zone-main',
    zoneActive: overrides.zoneActive ?? true,
    status: overrides.status ?? 'available',
    active: overrides.active ?? true,
    position: overrides.position ?? null,
  } as ManualAssignmentTable;
}

describe('TableCardGrid keyboard navigation', () => {
  it('uses roving tabIndex and supports arrow key navigation + toggle', async () => {
    // JSDOM lacks ResizeObserver; TableCardGrid uses it to measure columns.
    // A minimal stub is enough for deterministic keyboard behavior in tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).ResizeObserver ??
      class ResizeObserver {
        observe() {}
        disconnect() {}
      };

    const user = userEvent.setup();
    const onToggle = vi.fn();

    const tables: ManualAssignmentTable[] = [
      makeTable({ id: 't-1', tableNumber: '1' }),
      makeTable({ id: 't-2', tableNumber: '2', status: 'conflicted' }),
      makeTable({ id: 't-3', tableNumber: '3' }),
      makeTable({ id: 't-4', tableNumber: '4' }),
    ];

    const assignedTableIds = new Set<string>(['t-4']);

    const { container } = render(
      <TableCardGrid
        tables={tables}
        partySize={4}
        selectedTableIds={new Set<string>()}
        assignedTableIds={assignedTableIds}
        conflictedTableIds={new Set<string>()}
        disabled={false}
        onToggle={onToggle}
      />,
    );

    // The first focusable item should be t-1 (t-2 is conflicted, t-4 is assigned).
    await user.tab();
    expect(document.activeElement).toHaveAttribute('type', 'button');
    expect(document.activeElement).toHaveTextContent(/Table 1/i);

    // ArrowRight should skip t-2 (conflicted) and focus t-3.
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveTextContent(/Table 3/i);

    // Space toggles focused table.
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('t-3');

    // End jumps to the last focusable item (t-3 in this case, since t-4 is assigned).
    await user.keyboard('{End}');
    expect(document.activeElement).toHaveTextContent(/Table 3/i);

    // Sanity: only one item is tabbable (roving tabIndex), others should be -1.
    const buttons = container.querySelectorAll('button[type=\"button\"]');
    const tabIndexes = Array.from(buttons).map((b) => b.getAttribute('tabindex'));
    expect(tabIndexes.filter((t) => t === '0')).toHaveLength(1);
  });

  it('respects measured columns for ArrowDown/ArrowUp navigation', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).ResizeObserver ??
      class ResizeObserver {
        observe() {}
        disconnect() {}
      };

    const user = userEvent.setup();
    const onToggle = vi.fn();

    // Pretend our grid renders 3 columns so ArrowDown moves +3.
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((el: Element) => {
      const style = originalGetComputedStyle(el);
      return {
        ...style,
        gridTemplateColumns: '1fr 1fr 1fr',
      } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle;

    const tables: ManualAssignmentTable[] = [
      makeTable({ id: 't-1', tableNumber: '1' }),
      makeTable({ id: 't-2', tableNumber: '2' }),
      makeTable({ id: 't-3', tableNumber: '3' }),
      makeTable({ id: 't-4', tableNumber: '4' }),
      makeTable({ id: 't-5', tableNumber: '5' }),
      makeTable({ id: 't-6', tableNumber: '6' }),
    ];

    render(
      <TableCardGrid
        tables={tables}
        partySize={4}
        selectedTableIds={new Set<string>()}
        assignedTableIds={new Set<string>()}
        conflictedTableIds={new Set<string>()}
        disabled={false}
        onToggle={onToggle}
      />,
    );

    await user.tab();
    expect(document.activeElement).toHaveTextContent(/Table 1/i);

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toHaveTextContent(/Table 4/i);

    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toHaveTextContent(/Table 1/i);

    window.getComputedStyle = originalGetComputedStyle;
  });
});
