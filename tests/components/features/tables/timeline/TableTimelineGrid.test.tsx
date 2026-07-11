import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  TableTimelineGrid,
  TimelineSkeleton,
} from '@/components/features/tables/timeline/TableTimelineGrid';

import type { TableTimelineResponse, TableTimelineSegment } from '@/types/ops';

// Segment and window times render via local-time HH:MM conversion, so build
// ISO strings from local Date components for TZ-stable expectations.
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

function makeTimeline(overrides: Partial<TableTimelineResponse> = {}): TableTimelineResponse {
  return {
    date: '2026-07-04',
    timezone: 'Europe/London',
    window: { start: localIso(17, 0), end: localIso(22, 30), isClosed: false },
    slots: [],
    services: [],
    summary: null,
    tables: [],
    ...overrides,
  } as TableTimelineResponse;
}

function makeRow(
  tableOverrides: Partial<TableTimelineResponse['tables'][number]['table']> = {},
  segments: TableTimelineSegment[] = [makeSegment()],
): TableTimelineResponse['tables'][number] {
  return {
    table: {
      id: 'table-1',
      tableNumber: '1',
      capacity: 4,
      zoneId: 'zone-main',
      zoneName: 'Main',
      ...tableOverrides,
    },
    segments,
  } as TableTimelineResponse['tables'][number];
}

describe('TableTimelineGrid', () => {
  it('@smoke renders the loading skeleton without throwing', () => {
    const { container } = render(<TimelineSkeleton />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('@contract explains when the timeline window is unavailable', () => {
    render(
      <TableTimelineGrid
        timeline={makeTimeline({ window: { start: '', end: '', isClosed: true } })}
        tables={[]}
        onSelectSegment={vi.fn()}
        now={new Date(2026, 6, 4, 18, 0)}
        scrollRef={{ current: null }}
      />,
    );

    expect(
      screen.getByText('Timeline window is unavailable for the selected date.'),
    ).toBeInTheDocument();
  });

  it('@contract renders a row per table with zone, capacity, and slot headers', () => {
    const rows = [makeRow(), makeRow({ id: 'table-2', tableNumber: '2', zoneName: null }, [])];

    render(
      <TableTimelineGrid
        timeline={makeTimeline({ tables: rows })}
        tables={rows}
        onSelectSegment={vi.fn()}
        now={new Date(2026, 6, 4, 18, 0)}
        scrollRef={{ current: null }}
      />,
    );

    expect(screen.getByText('Table / Cap')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('22:30')).toBeInTheDocument();
    expect(screen.getByText('Table 1')).toBeInTheDocument();
    expect(screen.getByText('Table 2')).toBeInTheDocument();
    expect(screen.getByText('No zone')).toBeInTheDocument();
    expect(screen.getAllByText('Cap 4')).toHaveLength(2);
  });

  it('@contract @a11y renders reservation blocks with an accessible summary and fires selection', async () => {
    const user = userEvent.setup();
    const onSelectSegment = vi.fn();
    const segment = makeSegment();
    const row = makeRow({}, [segment]);

    render(
      <TableTimelineGrid
        timeline={makeTimeline({ tables: [row] })}
        tables={[row]}
        onSelectSegment={onSelectSegment}
        now={new Date(2026, 6, 4, 18, 0)}
        scrollRef={{ current: null }}
      />,
    );

    const block = screen.getByRole('button', { name: 'Alice Example 18:00–19:30' });
    await user.click(block);

    expect(onSelectSegment).toHaveBeenCalledWith(row.table, segment);
  });

  it('@contract does not draw blocks for available segments', () => {
    const row = makeRow({}, [
      makeSegment({ state: 'available', booking: null }),
      makeSegment({
        start: localIso(20, 0),
        end: localIso(21, 0),
        state: 'hold',
        booking: null,
      }),
    ]);

    render(
      <TableTimelineGrid
        timeline={makeTimeline({ tables: [row] })}
        tables={[row]}
        onSelectSegment={vi.fn()}
        now={new Date(2026, 6, 4, 18, 0)}
        scrollRef={{ current: null }}
      />,
    );

    const blocks = screen.getAllByRole('button');
    expect(blocks).toHaveLength(1);
    // Hold segments without a booking fall back to the status label.
    expect(blocks[0]).toHaveAccessibleName('Hold 20:00–21:00');
  });
});
