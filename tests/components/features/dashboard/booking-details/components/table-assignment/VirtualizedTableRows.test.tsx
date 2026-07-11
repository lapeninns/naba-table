import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VirtualizedTableRows } from '@/components/features/dashboard/booking-details/components/table-assignment/VirtualizedTableRows';

import { makeManualTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { VirtualizedTableRowsProps } from '@/components/features/dashboard/booking-details/components/table-assignment/VirtualizedTableRows';

const tableA = makeManualTable({ id: 'ta', tableNumber: 'T1' });
const tableB = makeManualTable({ id: 'tb', tableNumber: 'T2' });

function makeProps(overrides: Partial<VirtualizedTableRowsProps> = {}): VirtualizedTableRowsProps {
  return {
    rows: [
      { kind: 'header', section: 'Main', conflictCount: 1, tableCount: 2 },
      { kind: 'tables', tables: [tableA, tableB], startIndex: 0 },
    ],
    virtualRows: [
      { index: 0, key: 'row-0', start: 0 },
      { index: 1, key: 'row-1', start: 40 },
    ],
    activeIndex: 0,
    assignedTableIds: new Set<string>(),
    buttonRefs: { current: [] },
    columns: 2,
    conflictedTableIds: new Set<string>(),
    disabled: false,
    firstVisibleFocusable: 0,
    flatTables: [tableA, tableB],
    focusableByIndex: [true, true],
    measureElement: vi.fn(),
    onActiveIndexChange: vi.fn(),
    onFocusIndex: vi.fn(),
    onToggle: vi.fn(),
    partySize: 4,
    selectedTableIds: new Set<string>(),
    visibleIndexSet: new Set([0, 1]),
    ...overrides,
  };
}

describe('VirtualizedTableRows', () => {
  it('@contract renders section headers with conflict badges and the table cards', () => {
    render(<VirtualizedTableRows {...makeProps()} />);

    // The section name appears in the header row and inside each card's label.
    expect(screen.getAllByText('Main').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('1 conflict')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('@contract clicking a card toggles its table id', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<VirtualizedTableRows {...props} />);

    await user.click(screen.getByRole('button', { name: /Table T2/ }));

    expect(props.onToggle).toHaveBeenCalledWith('tb');
  });

  it('@contract arrow navigation moves focus to the neighbouring card', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<VirtualizedTableRows {...props} />);

    screen.getByRole('button', { name: /Table T1/ }).focus();
    await user.keyboard('{ArrowRight}');

    expect(props.onFocusIndex).toHaveBeenCalledWith(1);
    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it('@contract skips rows outside the virtual window', () => {
    render(
      <VirtualizedTableRows
        {...makeProps({ virtualRows: [{ index: 0, key: 'row-0', start: 0 }] })}
      />,
    );

    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.queryByText('T1')).not.toBeInTheDocument();
  });
});
