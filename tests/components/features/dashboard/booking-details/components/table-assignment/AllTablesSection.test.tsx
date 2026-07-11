import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { virtualizedSectionSpy } = vi.hoisted(() => ({
  virtualizedSectionSpy: vi.fn(() => <div data-testid="virtualized-all-tables" />),
}));

// The virtualized variant has its own suite (tests/components/VirtualizedAllTablesSection.test.tsx).
vi.mock(
  '@/components/features/dashboard/booking-details/components/table-assignment/VirtualizedAllTablesSection',
  () => ({ VirtualizedAllTablesSection: virtualizedSectionSpy }),
);

import { AllTablesSection } from '@/components/features/dashboard/booking-details/components/table-assignment/AllTablesSection';

import { makeManualTable } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { AllTablesSectionProps } from '@/components/features/dashboard/booking-details/components/table-assignment/AllTablesSection';
import type { ManualAssignmentTable } from '@/services/ops/bookings';

function makeProps(overrides: Partial<AllTablesSectionProps> = {}): AllTablesSectionProps {
  const tables = [
    makeManualTable({ id: 't1', tableNumber: 'T1', section: 'Main' }),
    makeManualTable({ id: 't2', tableNumber: 'T2', section: 'Terrace' }),
  ];
  return {
    groupedTables: new Map([
      ['Main', [tables[0]]],
      ['Terrace', [tables[1]]],
    ]),
    filteredTables: tables,
    totalCount: tables.length,
    partySize: 4,
    selectedTableIds: new Set<string>(),
    assignedTableIds: new Set<string>(),
    conflictedTableIds: new Set<string>(),
    disabled: false,
    onToggle: vi.fn(),
    ...overrides,
  };
}

describe('AllTablesSection', () => {
  it('@contract renders each zone group with its table cards below the virtualization threshold', () => {
    render(<AllTablesSection {...makeProps()} />);

    expect(screen.getByText('Full Inventory')).toBeInTheDocument();
    expect(screen.getByText('2 tables')).toBeInTheDocument();
    // Zone names appear as the group heading AND inside each card's section label.
    expect(screen.getAllByText('Main').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Terrace').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.queryByTestId('virtualized-all-tables')).not.toBeInTheDocument();
  });

  it('@contract shows the per-zone conflict badge', () => {
    render(<AllTablesSection {...makeProps({ conflictedTableIds: new Set(['t1']) })} />);

    expect(screen.getByText('1 conflict')).toBeInTheDocument();
  });

  it('@contract renders the empty state when no table survives the filters', () => {
    render(
      <AllTablesSection
        {...makeProps({ groupedTables: new Map(), filteredTables: [], totalCount: 0 })}
      />,
    );

    expect(screen.getByText(/No tables match the current filters/)).toBeInTheDocument();
  });

  it('@contract delegates to the virtualized section at 30+ tables', () => {
    const many: ManualAssignmentTable[] = Array.from({ length: 30 }, (_, index) =>
      makeManualTable({ id: `t${index}`, tableNumber: `T${index}` }),
    );

    render(
      <AllTablesSection
        {...makeProps({
          filteredTables: many,
          groupedTables: new Map([['Main', many]]),
          totalCount: many.length,
        })}
      />,
    );

    expect(screen.getByTestId('virtualized-all-tables')).toBeInTheDocument();
  });
});
