import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableTimelineHeader } from '@/components/features/tables/timeline/TableTimelineHeader';

type HeaderProps = Parameters<typeof TableTimelineHeader>[0];

// The window subtitle renders in the host's local timezone, so build the
// window from local Date components to stay deterministic in any TZ.
function localIso(hours: number, minutes: number): string {
  return new Date(2026, 6, 4, hours, minutes, 0, 0).toISOString();
}

function makeProps(overrides: Partial<HeaderProps> = {}): HeaderProps {
  return {
    search: '',
    selectedDate: '2026-07-04',
    selectedZoneName: null,
    service: 'all',
    timelineWindow: undefined,
    onSearchChange: vi.fn(),
    onSelectedDateChange: vi.fn(),
    ...overrides,
  };
}

describe('TableTimelineHeader', () => {
  it('@contract @a11y renders the heading and forwards search input changes', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableTimelineHeader {...props} />);

    expect(screen.getByRole('heading', { name: 'Capacity Timeline' })).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Find table');
    await user.type(searchInput, 'A1');

    expect(props.onSearchChange).toHaveBeenCalled();
    // Controlled input: each keystroke reports the next value.
    expect(props.onSearchChange).toHaveBeenCalledWith('A');
  });

  it('@contract summarizes service, zone, and window in the subtitle', () => {
    const { rerender } = render(<TableTimelineHeader {...makeProps()} />);
    expect(screen.getByText('All services')).toBeInTheDocument();

    rerender(
      <TableTimelineHeader
        {...makeProps({
          service: 'dinner',
          selectedZoneName: 'Patio',
          timelineWindow: { start: localIso(17, 0), end: localIso(22, 30), isClosed: false },
        })}
      />,
    );

    expect(screen.getByText(/Dinner/)).toBeInTheDocument();
    expect(screen.getByText(/Patio/)).toBeInTheDocument();
    // Window times render as locale time strings; assert the clock digits only.
    expect(screen.getByText(/5:00/)).toBeInTheDocument();
    expect(screen.getByText(/10:30|22:30/)).toBeInTheDocument();
  });

  it('@contract shows the formatted selected date on the calendar trigger', () => {
    render(<TableTimelineHeader {...makeProps({ selectedDate: '2026-07-04' })} />);

    expect(screen.getByRole('button', { name: 'Select date' })).toHaveTextContent('July 4th, 2026');
  });

  it('@contract falls back to a pick-a-date prompt without a selected date', () => {
    render(<TableTimelineHeader {...makeProps({ selectedDate: null })} />);

    expect(screen.getByRole('button', { name: 'Select date' })).toHaveTextContent('Pick a date');
  });

  it('@contract picks a date from the calendar popover and reports it as yyyy-MM-dd', async () => {
    const user = userEvent.setup();
    const props = makeProps({ selectedDate: '2026-07-04' });
    render(<TableTimelineHeader {...props} />);

    await user.click(screen.getByRole('button', { name: 'Select date' }));

    // react-day-picker exposes day buttons inside a grid; pick another July day.
    const dayButton = await screen.findByRole('button', { name: /10th July|July 10/ });
    await user.click(dayButton);

    expect(props.onSelectedDateChange).toHaveBeenCalledWith('2026-07-10');
  });
});
