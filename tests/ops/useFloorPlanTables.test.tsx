import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFloorPlanTables } from '@/components/features/seating/floor-plan/hooks/useFloorPlanTables';

import type { TableInventory } from '@/services/ops/tables';

function makeTable(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: overrides.id ?? 't-1',
    restaurantId: overrides.restaurantId ?? 'r-1',
    tableNumber: overrides.tableNumber ?? '1',
    capacity: overrides.capacity ?? 4,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? null,
    section: overrides.section ?? null,
    category: overrides.category ?? 'dining',
    seatingType: overrides.seatingType ?? 'standard',
    mobility: overrides.mobility ?? 'movable',
    zoneId: overrides.zoneId ?? 'z-1',
    zoneName: overrides.zoneName ?? 'Main',
    zoneActive: overrides.zoneActive ?? true,
    active: overrides.active ?? true,
    status: overrides.status ?? 'available',
    position: overrides.position ?? null,
    notes: overrides.notes ?? null,
  };
}

describe('useFloorPlanTables', () => {
  it('marks tables as loading when timeline is still loading', () => {
    const { result } = renderHook(() =>
      useFloorPlanTables({
        tables: [makeTable()],
        timeline: undefined,
        timelineLoading: true,
        currentTimestampMs: new Date('2026-02-12T19:30:00.000Z').getTime(),
        selectedZoneId: 'all',
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.displayStatus).toBe('loading');
    expect(result.current[0]?.partyName).toBeNull();
    expect(result.current[0]?.timeLabel).toBeNull();
  });

  it('defaults to available when timeline is not present but not loading (e.g. offline / disabled)', () => {
    const { result } = renderHook(() =>
      useFloorPlanTables({
        tables: [makeTable()],
        timeline: undefined,
        timelineLoading: false,
        currentTimestampMs: new Date('2026-02-12T19:30:00.000Z').getTime(),
        selectedZoneId: 'all',
      }),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.displayStatus).toBe('available');
  });
});

