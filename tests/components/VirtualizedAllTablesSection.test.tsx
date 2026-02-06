import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(6, count) }, (_, index) => ({
        index,
        key: index,
        start: index * 140,
        size: 140,
      })),
    getTotalSize: () => count * 140,
    scrollToIndex: vi.fn(),
    measureElement: () => {},
  }),
}));

import { VirtualizedAllTablesSection } from '@/components/features/dashboard/booking-details/components/table-assignment/VirtualizedAllTablesSection';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

function makeTable(id: string, overrides?: Partial<ManualAssignmentTable>): ManualAssignmentTable {
  return {
    id,
    tableNumber: id.replace('t-', ''),
    name: `Table ${id}`,
    capacity: 4,
    minPartySize: 1,
    maxPartySize: 8,
    section: 'Main',
    category: 'standard',
    seatingType: 'standard',
    mobility: 'standard',
    zoneId: 'zone-main',
    zoneActive: true,
    status: 'available',
    active: true,
    position: null,
    ...overrides,
  } as ManualAssignmentTable;
}

function buildGroupedTables(count: number) {
  const tables = Array.from({ length: count }, (_, i) => makeTable(`t-${i + 1}`));
  const map = new Map<string, ManualAssignmentTable[]>();
  map.set('Main', tables.slice(0, Math.ceil(count / 2)));
  map.set('Patio', tables.slice(Math.ceil(count / 2)));
  return { tables, map };
}

describe('VirtualizedAllTablesSection', () => {
  it('renders fewer table buttons than total when virtualized', async () => {
    const { tables, map } = buildGroupedTables(60);
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((el: Element) => {
      const style = originalGetComputedStyle(el);
      return {
        ...style,
        gridTemplateColumns: '1fr 1fr 1fr',
      } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle;

    const { container } = render(
      <VirtualizedAllTablesSection
        groupedTables={map}
        totalCount={tables.length}
        partySize={4}
        selectedTableIds={new Set<string>()}
        assignedTableIds={new Set<string>()}
        conflictedTableIds={new Set<string>()}
        disabled={false}
        onToggle={vi.fn()}
      />,
    );

    await waitFor(() => {
      const buttons = container.querySelectorAll('button[aria-pressed]');
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.length).toBeLessThan(tables.length);
    });

    window.getComputedStyle = originalGetComputedStyle;
  });

  it('supports keyboard navigation across virtualized rows', async () => {
    const { tables, map } = buildGroupedTables(36);
    const onToggle = vi.fn();
    const user = userEvent.setup();

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((el: Element) => {
      const style = originalGetComputedStyle(el);
      return {
        ...style,
        gridTemplateColumns: '1fr 1fr 1fr',
      } as CSSStyleDeclaration;
    }) as typeof window.getComputedStyle;

    const { container } = render(
      <VirtualizedAllTablesSection
        groupedTables={map}
        totalCount={tables.length}
        partySize={4}
        selectedTableIds={new Set<string>()}
        assignedTableIds={new Set<string>()}
        conflictedTableIds={new Set<string>()}
        disabled={false}
        onToggle={onToggle}
      />,
    );

    await waitFor(() => {
      const buttons = container.querySelectorAll('button[aria-pressed]');
      expect(buttons.length).toBeGreaterThan(0);
    });

    await user.tab();
    expect(document.activeElement).toHaveTextContent(/Table 1/i);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toHaveTextContent(/Table 2/i);

    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('t-2');

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(document.activeElement).toHaveTextContent(/Table 5/i);
    });

    window.getComputedStyle = originalGetComputedStyle;
  });
});
