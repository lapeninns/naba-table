import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ALL_ZONES_VALUE } from '@/components/features/tables/tableInventoryModel';
import { TableZonesSection } from '@/components/features/tables/TableZonesSection';

const zones = [
  { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 },
  { id: 'zone-patio', name: 'Patio', active: false, sortOrder: 1 },
];

type ZonesSectionProps = Parameters<typeof TableZonesSection>[0];

function makeProps(overrides: Partial<ZonesSectionProps> = {}): ZonesSectionProps {
  return {
    isActive: true,
    zoneDeleteBlockedMessage: null,
    isLoadingZones: false,
    isZonesError: false,
    zonesError: null,
    zones,
    filteredZones: zones,
    selectedZoneId: ALL_ZONES_VALUE,
    zoneStatusFilter: 'all',
    isZoneUpdatePending: false,
    isZoneDeletePending: false,
    onZoneStatusFilterChange: vi.fn(),
    onSelectZone: vi.fn(),
    onAddZone: vi.fn(),
    onEditZone: vi.fn(),
    onDeleteZone: vi.fn(),
    onToggleZoneActive: vi.fn(),
    ...overrides,
  };
}

describe('TableZonesSection', () => {
  it('@contract renders zone cards with activity badges and sort order', () => {
    render(<TableZonesSection {...makeProps()} />);

    expect(screen.getByRole('button', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patio' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('#0')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('@contract selects a zone and toggles back to all zones on reselect', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const { rerender } = render(<TableZonesSection {...props} />);

    await user.click(screen.getByRole('button', { name: 'Main' }));
    expect(props.onSelectZone).toHaveBeenLastCalledWith('zone-main');

    rerender(<TableZonesSection {...props} selectedZoneId="zone-main" />);
    await user.click(screen.getByRole('button', { name: 'Main' }));
    // Clicking the already-selected zone clears the filter.
    expect(props.onSelectZone).toHaveBeenLastCalledWith(ALL_ZONES_VALUE);
  });

  it('@contract @a11y toggles zone availability through the labelled switch', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableZonesSection {...props} />);

    await user.click(screen.getByRole('switch', { name: 'Toggle Main zone availability' }));
    expect(props.onToggleZoneActive).toHaveBeenCalledWith('zone-main', false);

    await user.click(screen.getByRole('switch', { name: 'Toggle Patio zone availability' }));
    expect(props.onToggleZoneActive).toHaveBeenCalledWith('zone-patio', true);
  });

  it('@contract disables the seasonal toggles while a zone update is pending', () => {
    render(<TableZonesSection {...makeProps({ isZoneUpdatePending: true })} />);

    expect(screen.getByRole('switch', { name: 'Toggle Main zone availability' })).toBeDisabled();
  });

  it('@contract @a11y fires edit and delete callbacks from the per-zone actions', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableZonesSection {...props} />);

    await user.click(screen.getByRole('button', { name: 'Edit zone Main' }));
    expect(props.onEditZone).toHaveBeenCalledWith(zones[0]);

    await user.click(screen.getByRole('button', { name: 'Delete zone Patio' }));
    expect(props.onDeleteZone).toHaveBeenCalledWith(zones[1]);
  });

  it('@contract reveals Add zone and the status filter behind the zone options collapsible', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<TableZonesSection {...props} />);

    expect(screen.queryByRole('button', { name: 'Add zone' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zone options' }));
    await user.click(screen.getByRole('button', { name: 'Add zone' }));
    expect(props.onAddZone).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Show'));
    await user.click(await screen.findByRole('option', { name: 'Inactive zones' }));
    expect(props.onZoneStatusFilterChange).toHaveBeenCalledWith('inactive');
  });

  it('@contract surfaces the blocked-delete warning when a zone still has tables', () => {
    render(
      <TableZonesSection
        {...makeProps({ zoneDeleteBlockedMessage: 'Move 3 tables out of Patio first.' })}
      />,
    );

    expect(screen.getByText('Zone cannot be deleted yet')).toBeInTheDocument();
    expect(screen.getByText('Move 3 tables out of Patio first.')).toBeInTheDocument();
  });

  it('@contract renders loading, error, and empty states', () => {
    const { rerender, container } = render(
      <TableZonesSection {...makeProps({ isLoadingZones: true })} />,
    );
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Main' })).not.toBeInTheDocument();

    rerender(
      <TableZonesSection
        {...makeProps({ isZonesError: true, zonesError: new Error('Zones exploded') })}
      />,
    );
    expect(screen.getByText('Zones unavailable')).toBeInTheDocument();
    expect(screen.getByText('Zones exploded')).toBeInTheDocument();

    rerender(<TableZonesSection {...makeProps({ zones: [], filteredZones: [] })} />);
    expect(
      screen.getByText(
        'No zones configured yet. Create your first zone to start organizing tables.',
      ),
    ).toBeInTheDocument();

    rerender(<TableZonesSection {...makeProps({ filteredZones: [] })} />);
    expect(
      screen.getByText('No zones match this filter. Show all to view inactive zones.'),
    ).toBeInTheDocument();
  });
});
