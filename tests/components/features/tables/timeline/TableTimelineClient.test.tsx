import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TableTimelineClient } from '@/components/features/tables/timeline/TableTimelineClient';

import type { SelectedSegment } from '@/components/features/tables/timeline/tableTimelineDomain';
import type { TableTimelineResponse, TableTimelineSegment } from '@/types/ops';

const { useTableTimelineControllerMock } = vi.hoisted(() => ({
  useTableTimelineControllerMock: vi.fn(),
}));

vi.mock('@/components/features/tables/timeline/useTableTimelineController', () => ({
  useTableTimelineController: useTableTimelineControllerMock,
}));

function localIso(hours: number, minutes: number): string {
  return new Date(2026, 6, 4, hours, minutes, 0, 0).toISOString();
}

function makeSegment(overrides: Partial<TableTimelineSegment> = {}): TableTimelineSegment {
  return {
    start: localIso(18, 0),
    end: localIso(19, 30),
    state: 'reserved',
    booking: {
      id: 'booking-1',
      customerName: 'Alice Example',
      partySize: 4,
      status: 'confirmed',
    },
    hold: null,
    ...overrides,
  } as TableTimelineSegment;
}

function makeTimeline(): TableTimelineResponse {
  const row = {
    table: {
      id: 'table-1',
      tableNumber: '1',
      capacity: 4,
      zoneId: 'zone-main',
      zoneName: 'Main',
    },
    segments: [makeSegment()],
  };

  return {
    date: '2026-07-04',
    timezone: 'Europe/London',
    window: { start: localIso(17, 0), end: localIso(22, 30), isClosed: false },
    slots: [],
    services: [],
    summary: {
      totalTables: 1,
      totalCapacity: 4,
      availableTables: 1,
      zones: [{ id: 'zone-main', name: 'Main', active: true }],
      serviceCapacities: [],
    },
    tables: [row],
  } as unknown as TableTimelineResponse;
}

type ControllerShape = {
  actionState: { releasing: boolean; error: string | null };
  closeSelectedSegment: () => void;
  filteredTables: TableTimelineResponse['tables'];
  handleReleaseHold: (holdId: string, bookingId: string | null) => void;
  hasActiveRestaurant: boolean;
  isRealtimeEnabled: boolean;
  now: Date;
  search: string;
  selectedDate: string | null;
  selectedSegment: SelectedSegment | null;
  selectedZone: string | null;
  selectedZoneName: string | null;
  service: 'all' | 'lunch' | 'dinner';
  setSearch: (value: string) => void;
  setSelectedDate: (value: string | null) => void;
  setSelectedSegment: (value: SelectedSegment) => void;
  setSelectedZone: (value: string | null) => void;
  setService: (value: 'all' | 'lunch' | 'dinner') => void;
  statusFilters: TableTimelineSegment['state'][];
  timeline: TableTimelineResponse | null;
  timelineQuery: {
    dataUpdatedAt: number;
    isFetching: boolean;
    isLoading: boolean;
    refetch: () => void;
  };
  timelineScrollRef: { current: HTMLDivElement | null };
  toggleStatusFilter: (state: TableTimelineSegment['state']) => void;
  zones: Array<{ id: string; name: string; active: boolean }>;
};

function makeController(overrides: Partial<ControllerShape> = {}): ControllerShape {
  const timeline = makeTimeline();
  return {
    actionState: { releasing: false, error: null },
    closeSelectedSegment: vi.fn(),
    filteredTables: timeline.tables,
    handleReleaseHold: vi.fn(),
    hasActiveRestaurant: true,
    isRealtimeEnabled: true,
    now: new Date(2026, 6, 4, 18, 0),
    search: '',
    selectedDate: '2026-07-04',
    selectedSegment: null,
    selectedZone: null,
    selectedZoneName: null,
    service: 'all',
    setSearch: vi.fn(),
    setSelectedDate: vi.fn(),
    setSelectedSegment: vi.fn(),
    setSelectedZone: vi.fn(),
    setService: vi.fn(),
    statusFilters: ['reserved', 'hold', 'available', 'out_of_service'],
    timeline,
    timelineQuery: {
      dataUpdatedAt: 0,
      isFetching: false,
      isLoading: false,
      refetch: vi.fn(),
    },
    timelineScrollRef: { current: null },
    toggleStatusFilter: vi.fn(),
    zones: timeline.summary?.zones ?? [],
    ...overrides,
  };
}

describe('TableTimelineClient', () => {
  beforeEach(() => {
    useTableTimelineControllerMock.mockReset();
  });

  it('@contract asks the operator to select a restaurant before rendering the timeline', () => {
    useTableTimelineControllerMock.mockReturnValue(
      makeController({ hasActiveRestaurant: false }),
    );

    render(<TableTimelineClient />);

    expect(
      screen.getByText('Select a restaurant to view table capacity timeline.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Capacity Timeline' })).not.toBeInTheDocument();
  });

  it('@contract shows the skeleton while the timeline query loads', () => {
    useTableTimelineControllerMock.mockReturnValue(
      makeController({
        timeline: null,
        filteredTables: [],
        timelineQuery: { dataUpdatedAt: 0, isFetching: true, isLoading: true, refetch: vi.fn() },
      }),
    );

    const { container } = render(<TableTimelineClient />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Unable to load table timeline. Please try again.'),
    ).not.toBeInTheDocument();
  });

  it('@contract shows the error notice when the timeline is missing after loading', () => {
    useTableTimelineControllerMock.mockReturnValue(
      makeController({ timeline: null, filteredTables: [] }),
    );

    render(<TableTimelineClient />);

    expect(
      screen.getByText('Unable to load table timeline. Please try again.'),
    ).toBeInTheDocument();
  });

  it('@contract renders the loaded timeline and reports segment selection to the controller', async () => {
    const user = userEvent.setup();
    const controller = makeController();
    useTableTimelineControllerMock.mockReturnValue(controller);

    render(<TableTimelineClient />);

    expect(screen.getByRole('heading', { name: 'Capacity Timeline' })).toBeInTheDocument();
    expect(screen.getByText('Table 1')).toBeInTheDocument();
    expect(screen.getByText(/Live updates on/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Alice Example 18:00–19:30' }));

    expect(controller.setSelectedSegment).toHaveBeenCalledWith({
      table: controller.timeline?.tables[0]?.table,
      segment: controller.timeline?.tables[0]?.segments[0],
    });
  });

  it('@contract wires the toolbar refresh through the timeline query', async () => {
    const user = userEvent.setup();
    const controller = makeController();
    useTableTimelineControllerMock.mockReturnValue(controller);

    render(<TableTimelineClient />);

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(controller.timelineQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract opens the segment dialog from controller state and closes it back through the controller', async () => {
    const user = userEvent.setup();
    const timeline = makeTimeline();
    const controller = makeController({
      selectedSegment: {
        table: timeline.tables[0].table,
        segment: timeline.tables[0].segments[0],
      },
    });
    useTableTimelineControllerMock.mockReturnValue(controller);

    render(<TableTimelineClient />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Example').length).toBeGreaterThan(0);

    await user.keyboard('{Escape}');
    expect(controller.closeSelectedSegment).toHaveBeenCalledTimes(1);
  });

  it('@contract falls back to the polling label when realtime is disabled', () => {
    useTableTimelineControllerMock.mockReturnValue(
      makeController({ isRealtimeEnabled: false }),
    );

    render(<TableTimelineClient />);

    expect(screen.getByText(/Live updates polling/)).toBeInTheDocument();
  });
});
