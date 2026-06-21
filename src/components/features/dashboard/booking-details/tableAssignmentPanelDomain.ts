import { getBookingClockMinutes } from '@reserve/shared/formatting/bookingDateTime';

import { groupTablesBySection } from './utils';

import type { AssignmentContext, ManualAssignmentTable } from './types';

export type TableAssignmentFitFilter =
  | 'all'
  | 'perfect'
  | 'exact'
  | 'within'
  | 'oversized'
  | 'too_small';

export type TableAssignmentSortOption = 'best' | 'capacity' | 'table';

export type TableAssignmentFilterState = {
  zoneFilter: string;
  fitFilter: TableAssignmentFitFilter;
  availabilityOnly: boolean;
  sortBy: TableAssignmentSortOption;
};

export function createDefaultTableAssignmentFilters(): TableAssignmentFilterState {
  return {
    availabilityOnly: false,
    fitFilter: 'all',
    sortBy: 'best',
    zoneFilter: 'all',
  };
}

export type TableAssignmentTimeline = {
  bookingStart: string | null;
  bookingEnd: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  parsedBookingStart: number | null;
  parsedBookingEnd: number | null;
  parsedWindowStart: number | null;
  parsedWindowEnd: number | null;
};

export function getTableAssignmentZoneOptions(tables: ManualAssignmentTable[]): string[] {
  const zones = new Set<string>();
  tables.forEach((table) => zones.add(table.section || 'Main'));
  return ['all', ...Array.from(zones).sort((a, b) => a.localeCompare(b))];
}

export function buildTableAssignmentInventoryView({
  conflictedTableIds,
  filters,
  partySize,
  tables,
}: {
  conflictedTableIds: Set<string>;
  filters: TableAssignmentFilterState;
  partySize: number;
  tables: ManualAssignmentTable[];
}) {
  const filteredTables = filterAndSortAssignmentTables({
    conflictedTableIds,
    filters,
    partySize,
    tables,
  });

  return {
    filteredTables,
    groupedTables: groupTablesBySection(filteredTables),
    zoneOptions: getTableAssignmentZoneOptions(tables),
  };
}

export function filterAndSortAssignmentTables({
  conflictedTableIds,
  filters,
  partySize,
  tables,
}: {
  conflictedTableIds: Set<string>;
  filters: TableAssignmentFilterState;
  partySize: number;
  tables: ManualAssignmentTable[];
}): ManualAssignmentTable[] {
  let list = tables;

  if (filters.zoneFilter !== 'all') {
    list = list.filter((table) => (table.section || 'Main') === filters.zoneFilter);
  }

  if (filters.availabilityOnly) {
    list = list.filter(
      (table) => table.active && table.status === 'available' && !conflictedTableIds.has(table.id),
    );
  }

  const fitFilter = filters.fitFilter;

  if (fitFilter === 'perfect') {
    list = list.filter((table) => table.capacity === partySize || table.capacity === partySize + 1);
  } else if (fitFilter !== 'all') {
    list = list.filter((table) => matchesCapacityFit(table, partySize, fitFilter));
  }

  const result = [...list];

  if (filters.sortBy === 'capacity') {
    result.sort((a, b) => a.capacity - b.capacity);
  } else if (filters.sortBy === 'table') {
    result.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
  } else {
    result.sort((a, b) => {
      const diffA = Math.abs(a.capacity - partySize);
      const diffB = Math.abs(b.capacity - partySize);
      return diffA - diffB;
    });
  }

  return result;
}

export function parseTableAssignmentTimeline({
  bookingEndTime,
  bookingStartTime,
  context,
}: {
  bookingEndTime?: string | null;
  bookingStartTime?: string | null;
  context: AssignmentContext | undefined;
}): TableAssignmentTimeline {
  const timelineBookingStart = bookingStartTime ?? context?.booking.start_time ?? null;
  const timelineBookingEnd = bookingEndTime ?? null;
  const timelineWindowStart = context?.window?.startAt ?? null;
  const timelineWindowEnd = context?.window?.endAt ?? null;
  const timezone = context?.timezone ?? 'UTC';

  return {
    bookingStart: timelineBookingStart,
    bookingEnd: timelineBookingEnd,
    windowStart: timelineWindowStart,
    windowEnd: timelineWindowEnd,
    parsedBookingStart: getBookingClockMinutes(timelineBookingStart, timezone),
    parsedBookingEnd: getBookingClockMinutes(timelineBookingEnd, timezone),
    parsedWindowStart: getBookingClockMinutes(timelineWindowStart, timezone),
    parsedWindowEnd: getBookingClockMinutes(timelineWindowEnd, timezone),
  };
}

function matchesCapacityFit(
  table: ManualAssignmentTable,
  partySize: number,
  fitFilter: Exclude<TableAssignmentFitFilter, 'all' | 'perfect'>,
): boolean {
  const diff = table.capacity - partySize;
  if (fitFilter === 'exact') return diff === 0;
  if (fitFilter === 'within') return diff > 0 && diff <= 2;
  if (fitFilter === 'oversized') return diff > 2;
  if (fitFilter === 'too_small') return diff < 0;
  return true;
}
