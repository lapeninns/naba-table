import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableTimelineToolbar } from '@/components/features/tables/timeline/TableTimelineToolbar';

type ToolbarProps = Parameters<typeof TableTimelineToolbar>[0];

const zones = [
  { id: 'zone-main', name: 'Main', active: true },
  { id: 'zone-patio', name: 'Patio', active: true },
];

function makeProps(overrides: Partial<ToolbarProps> = {}): ToolbarProps {
  return {
    dataUpdatedAt: 0,
    isFetching: false,
    selectedZone: null,
    service: 'all',
    statusFilters: ['reserved', 'hold', 'available', 'out_of_service'],
    zones,
    onRefresh: vi.fn(),
    onSelectZone: vi.fn(),
    onServiceChange: vi.fn(),
    onToggleStatusFilter: vi.fn(),
    ...overrides,
  };
}

describe('TableTimelineToolbar', () => {
  it('@contract @a11y selects zones through pressed chip buttons', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableTimelineToolbar {...props} />);

    expect(screen.getByRole('button', { name: 'All Zones' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Patio' }));
    expect(props.onSelectZone).toHaveBeenCalledWith('zone-patio');

    await user.click(screen.getByRole('button', { name: 'All Zones' }));
    expect(props.onSelectZone).toHaveBeenCalledWith(null);
  });

  it('@contract @a11y marks the selected zone chip as pressed', () => {
    render(<TableTimelineToolbar {...makeProps({ selectedZone: 'zone-main' })} />);

    expect(screen.getByRole('button', { name: 'Main' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All Zones' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('@contract toggles status filters and reflects their pressed state', async () => {
    const user = userEvent.setup();
    const props = makeProps({ statusFilters: ['reserved'] });
    render(<TableTimelineToolbar {...props} />);

    const reservedButton = screen.getByRole('button', { name: 'Reserved' });
    expect(reservedButton).toHaveAttribute('aria-pressed', 'true');

    const holdButton = screen.getByRole('button', { name: 'Hold' });
    expect(holdButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(holdButton);
    expect(props.onToggleStatusFilter).toHaveBeenCalledWith('hold');
  });

  it('@contract changes the service through the labelled select', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableTimelineToolbar {...props} />);

    await user.click(screen.getByLabelText('Service'));
    await user.click(await screen.findByRole('option', { name: 'Dinner' }));

    expect(props.onServiceChange).toHaveBeenCalledWith('dinner');
  });

  it('@contract refreshes on demand and locks the button while fetching', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { rerender } = render(<TableTimelineToolbar {...props} />);

    expect(screen.getByText('Last updated —')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);

    rerender(<TableTimelineToolbar {...props} isFetching />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  });
});
