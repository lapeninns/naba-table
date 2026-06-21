import { Constants } from '@/types/supabase';

import type { Database } from '@/types/supabase';

export type TableCategory = Database['public']['Enums']['table_category'];
export type TableSeatingType = Database['public']['Enums']['table_seating_type'];
export type TableMobility = Database['public']['Enums']['table_mobility'];
export type TableStatus = Database['public']['Enums']['table_status'];

export const TABLE_CATEGORY_VALUES = Constants.public.Enums.table_category;
export const TABLE_SEATING_TYPE_VALUES = Constants.public.Enums.table_seating_type;
export const TABLE_MOBILITY_VALUES = Constants.public.Enums.table_mobility;
export const TABLE_STATUS_VALUES = Constants.public.Enums.table_status;

const TABLE_CATEGORY_LABELS = {
  bar: 'Bar',
  dining: 'Dining',
  lounge: 'Lounge',
  patio: 'Patio',
  private: 'Private',
} as const satisfies Record<TableCategory, string>;

const TABLE_SEATING_TYPE_LABELS = {
  standard: 'Standard',
  sofa: 'Sofa',
  booth: 'Booth',
  high_top: 'High-top',
} as const satisfies Record<TableSeatingType, string>;

const TABLE_MOBILITY_LABELS = {
  movable: 'Movable',
  fixed: 'Fixed',
} as const satisfies Record<TableMobility, string>;

const TABLE_STATUS_LABELS = {
  available: 'Available',
  reserved: 'Reserved',
  occupied: 'Occupied',
  out_of_service: 'Out of service',
} as const satisfies Record<TableStatus, string>;

function toOptions<TValue extends string>(
  values: readonly TValue[],
  labels: Record<TValue, string>,
): { value: TValue; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const TABLE_CATEGORY_OPTIONS = toOptions(TABLE_CATEGORY_VALUES, TABLE_CATEGORY_LABELS);
export const TABLE_SEATING_TYPE_OPTIONS = toOptions(
  TABLE_SEATING_TYPE_VALUES,
  TABLE_SEATING_TYPE_LABELS,
);
export const TABLE_MOBILITY_OPTIONS = toOptions(TABLE_MOBILITY_VALUES, TABLE_MOBILITY_LABELS);
export const TABLE_STATUS_OPTIONS = toOptions(TABLE_STATUS_VALUES, TABLE_STATUS_LABELS);
