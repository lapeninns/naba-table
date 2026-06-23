import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FloorPlanCockpit } from '@/components/features/floor-plan/FloorPlanCockpit';
import { FloorPlanLegendFilter } from '@/components/features/floor-plan/FloorPlanLegendFilter';
import { SERVICE_STATE_META } from '@/components/features/floor-plan/domain/types';
import { ZoneOccupancySummary } from '@/components/features/floor-plan/ZoneOccupancySummary';

import type { ZoneRegion } from '@/components/features/floor-plan/domain/zones';
import type { FloorPlanStats } from '@/components/features/floor-plan/useFloorPlanState';
import type { LegendEntry } from '@/components/features/floor-plan/useFloorPlanState';

const zone = (overrides: Partial<ZoneRegion>): ZoneRegion =>
  ({
    key: 'z1',
    name: 'Main dining',
    count: 4,
    seatedCovers: 10,
    capacity: 20,
    occupancyPct: 50,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ...overrides,
  }) as unknown as ZoneRegion;

describe('ZoneOccupancySummary edge states', () => {
  it('shows a clear empty message when no zones are configured', () => {
    render(<ZoneOccupancySummary zones={[]} />);
    expect(screen.getByText('No zones configured yet.')).toBeInTheDocument();
  });

  it('truncates a very long zone name so it cannot push horizontal overflow', () => {
    const longName = 'The Conservatory & Garden Terrace, Upper Mezzanine and Riverside Annexe';
    render(<ZoneOccupancySummary zones={[zone({ name: longName })]} />);
    const label = screen.getByText(longName);
    expect(label.className).toContain('truncate');
    expect(label.className).toContain('min-w-0');
  });
});

describe('FloorPlanCockpit edge states', () => {
  it('renders an all-quiet service with zero values and no division errors', () => {
    const stats: FloorPlanStats = {
      seatedCovers: 0,
      bookedCovers: 0,
      bookedTables: 0,
      openTables: 0,
      capacity: 0,
      totalTables: 0,
      zoneCount: 0,
      occupancyPct: 0,
    };
    render(<FloorPlanCockpit stats={stats} />);
    const seated = screen.getByRole('group', { name: 'Covers seated' });
    expect(within(seated).getByText('0')).toBeInTheDocument();
    expect(within(seated).getByText('of 0 · 0% capacity')).toBeInTheDocument();
  });
});

describe('FloorPlanLegendFilter edge states', () => {
  it('renders nothing when there are no states in service', () => {
    const { container } = render(
      <FloorPlanLegendFilter legend={[]} spotlight={null} onToggle={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the active filter chip as pressed (the spotlight clear pill source of truth)', () => {
    const legend: LegendEntry[] = [
      { state: 'seated', ...SERVICE_STATE_META.seated, count: 4 },
      { state: 'free', ...SERVICE_STATE_META.free, count: 6 },
    ];
    render(<FloorPlanLegendFilter legend={legend} spotlight="seated" onToggle={() => {}} />);
    const seatedChip = screen.getByRole('button', { name: /seated/i });
    expect(seatedChip).toHaveAttribute('aria-pressed', 'true');
    const freeChip = screen.getByRole('button', { name: /free/i });
    expect(freeChip).toHaveAttribute('aria-pressed', 'false');
  });
});
