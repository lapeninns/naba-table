import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ALL_ZONES_VALUE } from '@/components/features/tables/tableInventoryModel';
import { TableZonesSection } from '@/components/features/tables/TableZonesSection';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'zone-main', name: 'Main', active: true, sortOrder: 0 },
  { id: 'zone-patio', name: 'Patio', active: false, sortOrder: 1 },
];

function makeTable(id: string, zoneId: string, capacity: number): TableInventory {
  return {
    id,
    restaurantId: 'rest-1',
    tableNumber: id,
    capacity,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId,
    zoneName: null,
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
  };
}

type ZonesSectionProps = Parameters<typeof TableZonesSection>[0];

function renderSection(overrides: Partial<ZonesSectionProps> = {}) {
  const props: ZonesSectionProps = {
    isLoadingZones: false,
    isZonesError: false,
    onRetryZones: vi.fn(),
    zones,
    tables: [makeTable('1', 'zone-main', 2), makeTable('2', 'zone-main', 4)],
    selectedZoneId: ALL_ZONES_VALUE,
    isZoneDeletePending: false,
    onSelectZone: vi.fn(),
    onAddZone: vi.fn(),
    onEditZone: vi.fn(),
    onDeleteZone: vi.fn(),
    onToggleZoneActive: vi.fn(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <TableZonesSection {...props} />
    </TooltipProvider>,
  );
  return props;
}

describe('TableZonesSection', () => {
  it('shows each zone with its tables, seats and service state in text', () => {
    renderSection();

    const main = screen.getByTestId('zone-zone-main');
    expect(within(main).getByText('2 tables · 6 seats')).toBeInTheDocument();
    expect(within(main).getByText('In service')).toBeInTheDocument();
    expect(within(main).getByText('Tables can be booked')).toBeInTheDocument();

    const patio = screen.getByTestId('zone-zone-patio');
    expect(within(patio).getByText('0 tables · 0 seats')).toBeInTheDocument();
    expect(within(patio).getByText('Out of service')).toBeInTheDocument();
    expect(within(patio).getByText('Tables kept, not bookable')).toBeInTheDocument();
    expect(within(patio).getByRole('switch', { name: 'Patio in service' })).not.toBeChecked();
  });

  it('uses the zone name as a toggle filter', async () => {
    const user = userEvent.setup();
    const props = renderSection({ selectedZoneId: 'zone-main' });

    expect(screen.getByRole('button', { name: 'Main' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Patio' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Patio' }));
    expect(props.onSelectZone).toHaveBeenCalledWith('zone-patio');
  });

  it('switches a zone in and out of service and offers edit and delete', async () => {
    const user = userEvent.setup();
    const props = renderSection();

    await user.click(screen.getByRole('switch', { name: 'Main in service' }));
    expect(props.onToggleZoneActive).toHaveBeenCalledWith(zones[0], false);

    await user.click(screen.getByRole('button', { name: 'Edit Main' }));
    expect(props.onEditZone).toHaveBeenCalledWith(zones[0]);
    await user.click(screen.getByRole('button', { name: 'Delete Patio' }));
    expect(props.onDeleteZone).toHaveBeenCalledWith(zones[1]);
    await user.click(screen.getByRole('button', { name: 'Add zone' }));
    expect(props.onAddZone).toHaveBeenCalledTimes(1);
  });

  it('invites adding the first zone when there are none', async () => {
    const user = userEvent.setup();
    const props = renderSection({ zones: [], tables: [] });
    expect(screen.getByText('No zones yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add your first zone' }));
    expect(props.onAddZone).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when zones fail to load', async () => {
    const user = userEvent.setup();
    const props = renderSection({ isZonesError: true });

    expect(screen.getByRole('alert')).toHaveTextContent('Zones couldn’t be loaded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetryZones).toHaveBeenCalledTimes(1);
  });

  it('shows a loading placeholder while zones load', () => {
    renderSection({ isLoadingZones: true });
    expect(screen.getByText('Loading zones')).toBeInTheDocument();
  });
});
