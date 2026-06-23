import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FloorPlanDetailPanel } from '@/components/features/floor-plan/FloorPlanDetailPanel';

import type { ZoneRegion } from '@/components/features/floor-plan/domain/zones';
import type { FloorPlanTable } from '@/components/features/floor-plan/domain/types';
import type { FloorPlanNode } from '@/components/features/floor-plan/useFloorPlanState';

function makeTable(overrides: Partial<FloorPlanTable> = {}): FloorPlanTable {
  return {
    id: 't5',
    restaurantId: 'r1',
    tableNumber: '5',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Main dining',
    zoneActive: true,
    active: true,
    status: 'available' as FloorPlanTable['status'],
    position: null,
    notes: null,
    segments: [],
    ...overrides,
  };
}

const seatedNode = {
  table: makeTable(),
  position: { xPercent: 0, yPercent: 0, rotation: 0 },
  resolved: {
    state: 'seated',
    segment: null,
    booking: {
      id: 'bk1',
      customerName: 'Okafor',
      partySize: 4,
      status: 'checked_in',
      startAt: '2026-06-23T19:00:00.000Z',
      endAt: '2026-06-23T20:30:00.000Z',
    },
    outOfService: false,
  },
  isSelected: true,
  dimmed: false,
} as unknown as FloorPlanNode;

const zones = [
  {
    key: 'z1',
    name: 'Main dining',
    count: 8,
    seatedCovers: 24,
    capacity: 34,
    occupancyPct: 71,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  {
    key: 'z2',
    name: 'Terrace',
    count: 2,
    seatedCovers: 2,
    capacity: 6,
    occupancyPct: 33,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
] as unknown as ZoneRegion[];

const handlers = {
  onClose: vi.fn(),
  onSeatParty: vi.fn(),
  onClearTable: vi.fn(),
  onMarkNoShow: vi.fn(),
  onSplit: vi.fn(),
  onJoin: vi.fn(),
};

describe('FloorPlanDetailPanel', () => {
  it('shows the zone-occupancy summary with accessible headings and grouping when nothing is selected', () => {
    render(
      <FloorPlanDetailPanel
        variant="aside"
        open={false}
        selectedNode={null}
        joinGroup={null}
        joinTargets={[]}
        zones={zones}
        timezone="Europe/London"
        isSeating={false}
        isClearing={false}
        {...handlers}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Service overview' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Occupancy by zone' }),
    ).toBeInTheDocument();
    const mainZone = screen.getByRole('group', { name: /main dining: 24 of 34 covers seated/i });
    expect(within(mainZone).getByText('Main dining')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /main dining occupancy/i })).toHaveAttribute(
      'aria-valuenow',
      '71',
    );
  });

  it('renders the selected-table detail with the status label as text (not colour-only) in the aside', () => {
    render(
      <FloorPlanDetailPanel
        variant="aside"
        open={false}
        selectedNode={seatedNode}
        joinGroup={null}
        joinTargets={[]}
        zones={zones}
        timezone="Europe/London"
        isSeating={false}
        isClearing={false}
        {...handlers}
      />,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Seated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close detail' })).toBeInTheDocument();
    // The aside is not a modal dialog.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the selected-table detail as a bottom sheet dialog below lg', () => {
    render(
      <FloorPlanDetailPanel
        variant="sheet"
        open
        selectedNode={seatedNode}
        joinGroup={null}
        joinTargets={[]}
        zones={zones}
        timezone="Europe/London"
        isSeating={false}
        isClearing={false}
        {...handlers}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Seated')).toBeInTheDocument();
  });

  it('keeps the sheet closed when no table is selected', () => {
    render(
      <FloorPlanDetailPanel
        variant="sheet"
        open={false}
        selectedNode={null}
        joinGroup={null}
        joinTargets={[]}
        zones={zones}
        timezone="Europe/London"
        isSeating={false}
        isClearing={false}
        {...handlers}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
