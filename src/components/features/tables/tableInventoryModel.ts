import {
  TABLE_CATEGORY_OPTIONS,
  TABLE_MOBILITY_OPTIONS,
  TABLE_SEATING_TYPE_OPTIONS,
  TABLE_STATUS_OPTIONS,
} from '@/lib/ops/table-inventory-reference';

import type { CreateTablePayload, TableInventory } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

export type ZoneStatusFilter = 'all' | 'active' | 'inactive';
export type TableStatusFilter = 'all' | 'active' | 'inactive';
export type TableZone = Pick<Zone, 'id' | 'name' | 'active' | 'sortOrder'>;
export type TableFormState = Omit<CreateTablePayload, 'position'>;

export const ALL_ZONES_VALUE = 'all-zones';

export const CATEGORY_OPTIONS: { value: TableInventory['category']; label: string }[] =
  TABLE_CATEGORY_OPTIONS;

export const SEATING_TYPE_OPTIONS: { value: TableInventory['seatingType']; label: string }[] =
  TABLE_SEATING_TYPE_OPTIONS;

export const MOBILITY_OPTIONS: { value: TableInventory['mobility']; label: string }[] =
  TABLE_MOBILITY_OPTIONS;

export const STATUS_OPTIONS: { value: TableInventory['status']; label: string }[] =
  TABLE_STATUS_OPTIONS;

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
