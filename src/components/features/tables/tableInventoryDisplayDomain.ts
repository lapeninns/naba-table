import {
  TABLE_MOBILITY_OPTIONS,
  TABLE_SEATING_TYPE_OPTIONS,
} from '@/lib/ops/table-inventory-reference';

import { ALL_ZONES_VALUE, type TableZone } from './tableInventoryModel';

import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

/**
 * Pure display and filtering rules for the Tables settings page. A table can be given to bookings
 * only when it is turned on, its zone is in service and it is not marked out of service; the
 * page shows that as one computed "Bookings" status.
 */

export type TableBookingBlockReason = 'turned-off' | 'zone-out-of-service' | 'out-of-service';

export type TableBookingStatus =
  | { bookable: true; reason: null; label: string }
  | { bookable: false; reason: TableBookingBlockReason; label: string };

export type TableBookableFilter = 'all' | 'bookable' | 'not-bookable';

export type TableListFilters = {
  query: string;
  zoneId: string;
  bookable: TableBookableFilter;
};

export type TableZoneLookup = ReadonlyMap<string, Pick<TableZone, 'name' | 'active'>>;

type StatusInput = Pick<TableInventory, 'active' | 'status' | 'zoneId' | 'zoneName' | 'zoneActive'>;

export const DEFAULT_TABLE_LIST_FILTERS: TableListFilters = {
  query: '',
  zoneId: ALL_ZONES_VALUE,
  bookable: 'all',
};

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? singular : plural}`;
}

export function buildTableZoneLookup(
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>,
): TableZoneLookup {
  return new Map(zones.map((zone) => [zone.id, { name: zone.name, active: zone.active }]));
}

/**
 * Zone state comes from the zones list when it is known, so an optimistic zone switch shows on
 * every table at once; the table row's own `zoneActive` is the fallback.
 */
export function getTableBookingStatus(
  table: StatusInput,
  zones?: TableZoneLookup,
): TableBookingStatus {
  const zone = zones?.get(table.zoneId);
  const zoneActive = zone ? zone.active : table.zoneActive !== false;
  const zoneName = zone?.name ?? table.zoneName ?? 'Its zone';

  if (!table.active) {
    return { bookable: false, reason: 'turned-off', label: 'Not bookable: turned off' };
  }
  if (!zoneActive) {
    return {
      bookable: false,
      reason: 'zone-out-of-service',
      label: `Not bookable: ${zoneName} is out of service`,
    };
  }
  if (table.status === 'out_of_service') {
    return {
      bookable: false,
      reason: 'out-of-service',
      label: 'Not bookable: marked out of service',
    };
  }
  return { bookable: true, reason: null, label: 'Bookable' };
}

export function matchesTableSearch(
  table: Pick<TableInventory, 'tableNumber' | 'notes'>,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase('en-GB');
  if (!needle) return true;
  return [table.tableNumber, table.notes ?? '']
    .join(' ')
    .toLocaleLowerCase('en-GB')
    .includes(needle);
}

export function filterTableInventory<TTable extends TableInventory>(
  tables: ReadonlyArray<TTable>,
  filters: TableListFilters,
  zones?: TableZoneLookup,
): TTable[] {
  return tables.filter((table) => {
    if (filters.zoneId !== ALL_ZONES_VALUE && table.zoneId !== filters.zoneId) return false;
    if (filters.bookable !== 'all') {
      const bookable = getTableBookingStatus(table, zones).bookable;
      if ((filters.bookable === 'bookable') !== bookable) return false;
    }
    return matchesTableSearch(table, filters.query);
  });
}

export function hasActiveTableFilters(filters: TableListFilters): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.zoneId !== ALL_ZONES_VALUE ||
    filters.bookable !== 'all'
  );
}

export function compareTableNumbers(a: string, b: string): number {
  return a.localeCompare(b, 'en-GB', { numeric: true, sensitivity: 'base' });
}

export type TableZoneGroup<TTable> = {
  zoneId: string;
  zoneName: string;
  zoneActive: boolean;
  tables: TTable[];
};

/** Groups tables under their zone in zone order; tables within a zone sort by number. */
export function groupTablesByZone<TTable extends TableInventory>(
  tables: ReadonlyArray<TTable>,
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>,
): TableZoneGroup<TTable>[] {
  const byZone = new Map<string, TTable[]>();
  for (const table of tables) {
    const list = byZone.get(table.zoneId) ?? [];
    list.push(table);
    byZone.set(table.zoneId, list);
  }

  const groups: TableZoneGroup<TTable>[] = [];
  for (const zone of zones) {
    const list = byZone.get(zone.id);
    if (!list) continue;
    byZone.delete(zone.id);
    groups.push({ zoneId: zone.id, zoneName: zone.name, zoneActive: zone.active, tables: list });
  }
  // Tables whose zone is not in the zones list (should not happen) still show, after the rest.
  for (const [zoneId, list] of byZone) {
    groups.push({
      zoneId,
      zoneName: list[0]?.zoneName ?? 'Other tables',
      zoneActive: list[0]?.zoneActive !== false,
      tables: list,
    });
  }

  return groups.map((group) => ({
    ...group,
    tables: group.tables.slice().sort((a, b) => compareTableNumbers(a.tableNumber, b.tableNumber)),
  }));
}

export function getZoneTableStats(
  tables: ReadonlyArray<Pick<TableInventory, 'zoneId' | 'capacity'>>,
  zoneId: string,
): { tableCount: number; seatCount: number } {
  const inZone = tables.filter((table) => table.zoneId === zoneId);
  return {
    tableCount: inZone.length,
    seatCount: inZone.reduce((total, table) => total + table.capacity, 0),
  };
}

export function formatZoneTableStats(stats: { tableCount: number; seatCount: number }): string {
  return `${countLabel(stats.tableCount, 'table')} · ${countLabel(stats.seatCount, 'seat')}`;
}

export type TableInventoryOverview = {
  totalTables: number;
  bookableTables: number;
  bookableSeats: number;
  notBookableTables: number;
  notBookableReasons: Record<TableBookingBlockReason, number>;
  zoneCount: number;
  zonesOutOfService: number;
};

export function buildTableInventoryOverview(
  tables: ReadonlyArray<TableInventory>,
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'name' | 'active'>>,
): TableInventoryOverview {
  const lookup = buildTableZoneLookup(zones);
  const notBookableReasons: Record<TableBookingBlockReason, number> = {
    'turned-off': 0,
    'zone-out-of-service': 0,
    'out-of-service': 0,
  };
  let bookableTables = 0;
  let bookableSeats = 0;

  for (const table of tables) {
    const status = getTableBookingStatus(table, lookup);
    if (status.bookable) {
      bookableTables += 1;
      bookableSeats += table.capacity;
    } else {
      notBookableReasons[status.reason] += 1;
    }
  }

  return {
    totalTables: tables.length,
    bookableTables,
    bookableSeats,
    notBookableTables: tables.length - bookableTables,
    notBookableReasons,
    zoneCount: zones.length,
    zonesOutOfService: zones.filter((zone) => !zone.active).length,
  };
}

export function describeNotBookableReasons(overview: TableInventoryOverview): string {
  if (overview.totalTables === 0) return 'No tables yet';
  if (overview.notBookableTables === 0) return 'Every table can be booked';
  const { notBookableReasons: reasons } = overview;
  return [
    reasons['turned-off'] > 0 ? `${reasons['turned-off']} turned off` : null,
    reasons['zone-out-of-service'] > 0
      ? `${reasons['zone-out-of-service']} in a zone out of service`
      : null,
    reasons['out-of-service'] > 0 ? `${reasons['out-of-service']} marked out of service` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function describeZonesInService(overview: TableInventoryOverview): string {
  if (overview.zoneCount === 0) return 'No zones yet';
  return overview.zonesOutOfService > 0
    ? `${overview.zonesOutOfService} out of service`
    : 'All in service';
}

export type ServiceCapacityLine = {
  key: string;
  label: string;
  value: string;
  description: string;
};

/** The server's per-service capacity (`serviceCapacities`), worded for the metrics row. */
export function buildServiceCapacityLines(
  summary: Pick<TableInventorySummary, 'serviceCapacities'> | null,
): ServiceCapacityLine[] {
  if (!summary) return [];
  return summary.serviceCapacities.map((service) => ({
    key: service.key,
    label: service.label,
    value: countLabel(service.capacity, 'cover'),
    description:
      service.turnsPerTable > 0
        ? `About ${countLabel(service.turnsPerTable, 'turn')} per table · ${countLabel(
            service.tablesConsidered,
            'table',
          )}`
        : 'The meal time is shorter than one turn',
  }));
}

/** Party size a table accepts; no largest party means "up to its seats", as allocation does. */
export function formatTablePartySize(
  table: Pick<TableInventory, 'minPartySize' | 'maxPartySize' | 'capacity'>,
): string {
  const largest = table.maxPartySize ?? table.capacity;
  return table.minPartySize === largest
    ? `${table.minPartySize}`
    : `${table.minPartySize}–${largest}`;
}

function optionLabel<TValue extends string>(
  options: ReadonlyArray<{ value: TValue; label: string }>,
  value: TValue,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/** Short details line: non-standard seating, fixed tables, section and notes. */
export function formatTableDetails(
  table: Pick<TableInventory, 'seatingType' | 'mobility' | 'section' | 'notes'>,
): string {
  return [
    table.seatingType !== 'standard'
      ? optionLabel(TABLE_SEATING_TYPE_OPTIONS, table.seatingType)
      : null,
    table.mobility === 'fixed' ? optionLabel(TABLE_MOBILITY_OPTIONS, table.mobility) : null,
    table.section?.trim() || null,
    table.notes?.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export type TableListEmptyState = {
  title: string;
  description: string;
  action: 'add-table' | 'clear-filters' | null;
};

export function getTableListEmptyState(
  totalTables: number,
  zoneCount: number,
): TableListEmptyState {
  if (totalTables > 0) {
    return {
      title: 'No tables match',
      description: 'Try another zone, search or filter.',
      action: 'clear-filters',
    };
  }
  return zoneCount > 0
    ? {
        title: 'No tables yet',
        description: 'Add your tables with their seats and party sizes. You can add details later.',
        action: 'add-table',
      }
    : {
        title: 'No tables yet',
        description: 'Add a zone first, then your tables.',
        action: null,
      };
}
