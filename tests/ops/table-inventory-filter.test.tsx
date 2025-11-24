import { describe, expect, it } from 'vitest';

import { filterTablesByStatus, filterZonesByStatus } from '@/components/features/tables/TableInventoryClient';
import type { TableInventory } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

const sampleZones: Zone[] = [
  { id: 'z1', restaurantId: 'r1', name: 'Active', sortOrder: 1, active: true, createdAt: '', updatedAt: '' },
  { id: 'z2', restaurantId: 'r1', name: 'Inactive', sortOrder: 2, active: false, createdAt: '', updatedAt: '' },
];

const sampleTables: TableInventory[] = [
  {
    id: 't1',
    restaurantId: 'r1',
    tableNumber: '1',
    capacity: 2,
    minPartySize: 1,
    maxPartySize: 4,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Active',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
  },
  {
    id: 't2',
    restaurantId: 'r1',
    tableNumber: '2',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: 6,
    section: null,
    category: 'patio',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z1',
    zoneName: 'Active',
    zoneActive: true,
    active: false,
    status: 'out_of_service',
    position: null,
    notes: null,
  },
  {
    id: 't3',
    restaurantId: 'r1',
    tableNumber: '3',
    capacity: 2,
    minPartySize: 1,
    maxPartySize: 2,
    section: null,
    category: 'bar',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'z2',
    zoneName: 'Inactive',
    zoneActive: false,
    active: true,
    status: 'available',
    position: null,
    notes: null,
  },
];

describe('filterZonesByStatus', () => {
  it('returns only active zones when filter is active', () => {
    expect(filterZonesByStatus(sampleZones, 'active')).toEqual([sampleZones[0]]);
  });

  it('returns only inactive zones when filter is inactive', () => {
    expect(filterZonesByStatus(sampleZones, 'inactive')).toEqual([sampleZones[1]]);
  });

  it('returns all zones when filter is all', () => {
    expect(filterZonesByStatus(sampleZones, 'all')).toHaveLength(2);
  });
});

describe('filterTablesByStatus', () => {
  it('keeps only active tables with active zones when filter is active', () => {
    expect(filterTablesByStatus(sampleTables, 'active')).toEqual([sampleTables[0]]);
  });

  it('keeps only inactive tables or those in inactive zones when filter is inactive', () => {
    const result = filterTablesByStatus(sampleTables, 'inactive');
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('returns all tables when filter is all', () => {
    expect(filterTablesByStatus(sampleTables, 'all')).toHaveLength(sampleTables.length);
  });
});
