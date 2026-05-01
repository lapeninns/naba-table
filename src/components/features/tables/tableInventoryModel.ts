import type { CreateTablePayload, TableInventory } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

export type ZoneStatusFilter = 'all' | 'active' | 'inactive';
export type TableStatusFilter = 'all' | 'active' | 'inactive';
export type TableZone = Pick<Zone, 'id' | 'name' | 'active' | 'sortOrder'>;
export type TableFormState = Omit<CreateTablePayload, 'position'>;

export const ALL_ZONES_VALUE = 'all-zones';

export const CATEGORY_OPTIONS: { value: TableInventory['category']; label: string }[] = [
  { value: 'dining', label: 'Dining' },
  { value: 'patio', label: 'Patio' },
  { value: 'bar', label: 'Bar' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'private', label: 'Private' },
];

export const SEATING_TYPE_OPTIONS: { value: TableInventory['seatingType']; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'sofa', label: 'Sofa' },
  { value: 'booth', label: 'Booth' },
  { value: 'high_top', label: 'High-top' },
];

export const MOBILITY_OPTIONS: { value: TableInventory['mobility']; label: string }[] = [
  { value: 'movable', label: 'Movable' },
  { value: 'fixed', label: 'Fixed' },
];

export const STATUS_OPTIONS: { value: TableInventory['status']; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'out_of_service', label: 'Out of service' },
];

export function filterZonesByStatus(zones: TableZone[], filter: ZoneStatusFilter): TableZone[] {
  if (filter === 'active') return zones.filter((zone) => zone.active);
  if (filter === 'inactive') return zones.filter((zone) => zone.active === false);
  return zones;
}

export function filterTablesByStatus(
  tables: TableInventory[],
  filter: TableStatusFilter,
): TableInventory[] {
  if (filter === 'active') {
    return tables.filter((table) => table.active && table.zoneActive !== false);
  }
  if (filter === 'inactive') {
    return tables.filter((table) => !table.active || table.zoneActive === false);
  }
  return tables;
}
