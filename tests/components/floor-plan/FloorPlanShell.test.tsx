import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FloorPlanShell } from '@/components/features/floor-plan/FloorPlanShell';
import { SERVICE_STATE_META } from '@/components/features/floor-plan/domain/types';
import type { FloorPlanState } from '@/components/features/floor-plan/useFloorPlanState';

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

vi.mock('@/components/features/floor-plan/FloorPlanCanvas', () => ({
  FloorPlanCanvas: () => <div data-testid="floor-map-canvas" />,
}));

vi.mock('@/components/features/floor-plan/TimeScrubber', () => ({
  TimeScrubber: () => <div data-testid="time-scrubber" />,
}));

function makeFloorPlanState(overrides: Partial<FloorPlanState> = {}): FloorPlanState {
  const noop = vi.fn();
  const floorPlanState = {
    restaurantId: 'restaurant-1',
    venueName: 'The Sample Dining Room',
    timezone: 'Europe/London',
    date: '2026-06-23',
    canEdit: true,
    isLoading: false,
    isError: false,
    error: null,
    isEmpty: false,
    seeded: false,
    refetch: noop,
    nodes: [],
    zones: [],
    joinGroups: [],
    legend: [
      { state: 'seated' as const, ...SERVICE_STATE_META.seated, count: 4 },
      { state: 'free' as const, ...SERVICE_STATE_META.free, count: 6 },
    ],
    stats: {
      seatedCovers: 12,
      bookedCovers: 8,
      bookedTables: 2,
      openTables: 6,
      capacity: 40,
      totalTables: 10,
      zoneCount: 3,
      occupancyPct: 30,
    },
    selectedNode: null,
    joinGroupForSelected: null,
    joinTargetsForSelected: [],
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    selectTable: noop,
    clearSelection: noop,
    spotlight: 'seated' as const,
    toggleSpotlight: noop,
    clearSpotlight: noop,
    windowStartMs: Date.parse('2026-06-23T16:00:00.000Z'),
    windowEndMs: Date.parse('2026-06-23T23:00:00.000Z'),
    effectiveMs: Date.parse('2026-06-23T19:30:00.000Z'),
    liveNowMs: Date.parse('2026-06-23T19:30:00.000Z'),
    scrubbing: false,
    playing: false,
    setScrub: noop,
    backToNow: noop,
    togglePlay: noop,
    previewDrag: noop,
    commitDrag: noop,
    isPersistingLayout: false,
    seatParty: noop,
    clearTable: noop,
    markNoShowParty: noop,
    splitTable: noop,
    joinTables: noop,
    isSeating: false,
    isClearing: false,
    ...overrides,
  };

  return floorPlanState as FloorPlanState;
}

describe('FloorPlanShell', () => {
  it('keeps service filters inside the floor-map panel before replay controls', () => {
    render(<FloorPlanShell fp={makeFloorPlanState()} clock="19:30" />);

    const panel = screen.getByTestId('floor-map-panel');
    const filter = within(panel).getByRole('group', { name: /filter tables by status/i });
    const scrubber = within(panel).getByTestId('time-scrubber');

    expect(
      filter.compareDocumentPosition(scrubber) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(panel).getByRole('button', { name: /showing seated/i })).toBeInTheDocument();
  });
});
