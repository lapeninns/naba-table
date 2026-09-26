import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableTimelineSegmentDialog } from '@/components/features/tables/timeline/TableTimelineSegmentDialog';

import type { SelectedSegment } from '@/components/features/tables/timeline/tableTimelineDomain';
import type { TableTimelineSegment } from '@/types/ops';

// Dialog times render via toLocaleTimeString in the host TZ; local Date inputs
// keep the expected clock digits stable across timezones.
function localIso(hours: number, minutes: number): string {
  return new Date(2026, 6, 4, hours, minutes, 0, 0).toISOString();
}

const table = {
  id: 'table-1',
  tableNumber: '5',
  capacity: 4,
  zoneId: 'zone-main',
  zoneName: 'Main',
} as SelectedSegment['table'];

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

type DialogProps = Parameters<typeof TableTimelineSegmentDialog>[0];

function makeProps(overrides: Partial<DialogProps> = {}): DialogProps {
  return {
    selected: { table, segment: makeSegment() },
    onClose: vi.fn(),
    onReleaseHold: vi.fn(),
    actionState: { releasing: false, error: null },
    ...overrides,
  };
}

describe('TableTimelineSegmentDialog', () => {
  it('@contract renders nothing without a selected segment', () => {
    render(<TableTimelineSegmentDialog {...makeProps({ selected: null })} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('@contract @a11y shows booking details with a link to the booking search', () => {
    render(<TableTimelineSegmentDialog {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Table 5' })).toBeInTheDocument();
    expect(screen.getByText(/Main/)).toBeInTheDocument();
    expect(screen.getByText('4 seats')).toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('Party of 4 · confirmed')).toBeInTheDocument();
    // Duration derives from the segment bounds: 90 minutes.
    expect(screen.getByText(/\(90m\)/)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /View booking/ })).toHaveAttribute(
      'href',
      '/bookings?query=Alice%20Example',
    );
  });

  it('@contract releases a hold by its id', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      selected: {
        table,
        segment: makeSegment({
          state: 'hold',
          booking: null,
          hold: { id: 'hold-1', bookingId: 'booking-9' },
        }),
      },
    });
    render(<TableTimelineSegmentDialog {...props} />);

    expect(screen.getByText('Table is on hold')).toBeInTheDocument();
    expect(screen.getByText('Linked booking ID: booking-9')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Release hold' }));
    expect(props.onReleaseHold).toHaveBeenCalledWith('hold-1');
  });

  it('@contract releases an unbound hold (no booking) too', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      selected: {
        table,
        segment: makeSegment({
          state: 'hold',
          booking: null,
          hold: { id: 'hold-2', bookingId: null },
        }),
      },
    });
    render(<TableTimelineSegmentDialog {...props} />);

    expect(screen.getByText('Not linked to a booking')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Release hold' });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(props.onReleaseHold).toHaveBeenCalledWith('hold-2');
  });

  it('@contract disables the release action while releasing and surfaces errors', () => {
    const holdSelection = {
      table,
      segment: makeSegment({
        state: 'hold',
        booking: null,
        hold: { id: 'hold-1', bookingId: 'booking-9' },
      }),
    };

    const { rerender } = render(
      <TableTimelineSegmentDialog
        {...makeProps({
          selected: holdSelection,
          actionState: { releasing: true, error: null },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Releasing hold…' })).toBeDisabled();

    rerender(
      <TableTimelineSegmentDialog
        {...makeProps({
          selected: holdSelection,
          actionState: { releasing: false, error: 'Hold could not be released.' },
        })}
      />,
    );
    expect(screen.getByText('Hold could not be released.')).toBeInTheDocument();
  });

  it('@contract describes out-of-service and available segments without booking actions', () => {
    const { rerender } = render(
      <TableTimelineSegmentDialog
        {...makeProps({
          selected: {
            table,
            segment: makeSegment({ state: 'out_of_service', booking: null }),
          },
        })}
      />,
    );

    // Status badge and body copy both read "Out of service".
    expect(screen.getAllByText('Out of service').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Temporarily unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View booking/ })).not.toBeInTheDocument();

    rerender(
      <TableTimelineSegmentDialog
        {...makeProps({
          selected: {
            table,
            segment: makeSegment({ state: 'available', booking: null }),
          },
        })}
      />,
    );

    expect(screen.getByText('Available slot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create booking' })).toBeDisabled();
  });

  it('@contract closes through the dialog dismiss control', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableTimelineSegmentDialog {...props} />);

    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
