import {
  TABLE_CATEGORY_OPTIONS,
  TABLE_MOBILITY_OPTIONS,
  TABLE_SEATING_TYPE_OPTIONS,
  TABLE_STATUS_OPTIONS,
} from '@/lib/ops/table-inventory-reference';

import type { CreateTablePayload, TableInventory } from '@/services/ops/tables';
import type { Zone } from '@/services/ops/zones';

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
