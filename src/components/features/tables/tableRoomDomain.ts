import {
  TABLE_CATEGORY_OPTIONS,
  TABLE_SEATING_TYPE_OPTIONS,
} from '@/lib/ops/table-inventory-reference';

import {
  compareTableNumbers,
  getTableBookingStatus,
  type TableBookingBlockReason,
  type TableBookableFilter,
  type TableZoneLookup,
} from './tableInventoryDisplayDomain';

import type { TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

/**
 * Pure rules for the Tables room view: joining, seat coverage and what needs a look.
 *
 * Joining mirrors the allocator: movable tables that can be booked are auto-adjacent to every
 * other such table in their zone (`auto_zone_adjacencies` migration), and a plan joins at most
 * `getAllocatorKMax()` tables. Fixed tables are always used on their own.
 */
export const TABLE_JOIN_MAX_TABLES = 5;

/** Party sizes charted in "Tables by party size"; the last column reads "12+". */
export const PARTY_COVERAGE_SIZES = 12;

const SEAT_DOT_LIMIT = 8;
/** Tables this big take two tile columns. */
export const BIG_TABLE_SEATS = 8;

type ZoneRef = Pick<TableZone, 'id' | 'name' | 'active'>;
type JoinInput = Pick<
  TableInventory,
  'id' | 'capacity' | 'mobility' | 'zoneId' | 'zoneName' | 'zoneActive' | 'active' | 'status'
>;

export function isMovableTable(table: Pick<TableInventory, 'mobility'>): boolean {
  return table.mobility !== 'fixed';
}

function isJoinable(table: JoinInput, zones: TableZoneLookup): boolean {
  return isMovableTable(table) && getTableBookingStatus(table, zones).bookable;
}

function joinGroup<TTable extends JoinInput>(
  tables: ReadonlyArray<TTable>,
  zoneId: string,
  zones: TableZoneLookup,
): TTable[] {
  return tables.filter((table) => table.zoneId === zoneId && isJoinable(table, zones));
}

/** Tables the given table can be joined with; empty when it is fixed or not bookable. */
export function getJoinPartners<TTable extends JoinInput>(
  table: TTable,
  tables: ReadonlyArray<TTable>,
  zones: TableZoneLookup,
): TTable[] {
  if (!isJoinable(table, zones)) return [];
  return joinGroup(tables, table.zoneId, zones).filter((other) => other.id !== table.id);
}

export type ZoneJoinSummary = {
  joinableCount: number;
  /** Most tables one join can use here; 0 when fewer than two can be joined. */
  maxTables: number;
  /** Largest party a join seats here; 0 when fewer than two can be joined. */
  maxParty: number;
  fixedCount: number;
};

export function getZoneJoinSummary(
  tables: ReadonlyArray<JoinInput>,
  zoneId: string,
  zones: TableZoneLookup,
): ZoneJoinSummary {
  const group = joinGroup(tables, zoneId, zones);
  const fixedCount = tables.filter(
    (table) => table.zoneId === zoneId && !isMovableTable(table),
  ).length;
  if (group.length < 2) {
    return { joinableCount: group.length, maxTables: 0, maxParty: 0, fixedCount };
  }
  const maxTables = Math.min(TABLE_JOIN_MAX_TABLES, group.length);
  const maxParty = group
    .map((table) => table.capacity)
    .sort((a, b) => b - a)
    .slice(0, maxTables)
    .reduce((sum, seats) => sum + seats, 0);
  return { joinableCount: group.length, maxTables, maxParty, fixedCount };
}

/** Largest party a table takes on its own; no largest party means "up to its seats". */
export function getTableLargestParty(
  table: Pick<TableInventory, 'maxPartySize' | 'capacity'>,
): number {
  return table.maxPartySize ?? table.capacity;
}

export type SeatStats = {
  bookableSeats: number;
  totalSeats: number;
  bookableTables: number;
  totalTables: number;
};

export function buildSeatStats(
  tables: ReadonlyArray<JoinInput>,
  zones: TableZoneLookup,
): SeatStats {
  let bookableSeats = 0;
  let bookableTables = 0;
  let totalSeats = 0;
  for (const table of tables) {
    totalSeats += table.capacity;
    if (getTableBookingStatus(table, zones).bookable) {
      bookableSeats += table.capacity;
      bookableTables += 1;
    }
  }
  return { bookableSeats, totalSeats, bookableTables, totalTables: tables.length };
}

export type PartyCoverageSize = {
  size: number;
  label: string;
  /** Bookable tables that take this party on their own. */
  count: number;
  /** No single table takes it, but joining movable tables does. */
  joinOnly: boolean;
};

export type PartyCoverage = {
  sizes: PartyCoverageSize[];
  largestSingle: number;
  joinTop: { maxParty: number; zoneName: string } | null;
  /** Largest party that can be seated at all, by one table or a join. */
  reach: number;
  /** Party sizes up to `reach` that nothing takes. */
  gaps: number[];
};

export function buildPartyCoverage(
  tables: ReadonlyArray<TableInventory>,
  zones: ReadonlyArray<ZoneRef>,
  lookup: TableZoneLookup,
): PartyCoverage {
  const bookable = tables.filter((table) => getTableBookingStatus(table, lookup).bookable);
  const joinTop =
    zones
      .filter((zone) => zone.active)
      .map((zone) => ({
        maxParty: getZoneJoinSummary(tables, zone.id, lookup).maxParty,
        zoneName: zone.name,
      }))
      .filter((zone) => zone.maxParty > 0)
      .sort((a, b) => b.maxParty - a.maxParty)[0] ?? null;
  const joinMax = joinTop?.maxParty ?? 0;
  const largestSingle = bookable.reduce(
    (largest, table) => Math.max(largest, getTableLargestParty(table)),
    0,
  );
  const reach = Math.max(largestSingle, joinMax);

  const sizes = Array.from({ length: PARTY_COVERAGE_SIZES }, (_, index): PartyCoverageSize => {
    const size = index + 1;
    const count = bookable.filter(
      (table) => size >= table.minPartySize && size <= getTableLargestParty(table),
    ).length;
    return {
      size,
      label: size === PARTY_COVERAGE_SIZES ? `${size}+` : String(size),
      count,
      joinOnly: count === 0 && size <= joinMax,
    };
  });

  const gaps = sizes
    .filter((item) => item.count === 0 && !item.joinOnly && item.size <= reach)
    .map((item) => item.size);

  return { sizes, largestSingle, joinTop, reach, gaps };
}

const SHORT_BLOCK_LABELS: Record<TableBookingBlockReason, string> = {
  'turned-off': 'Turned off',
  'zone-out-of-service': 'Zone off',
  'out-of-service': 'Out of service',
};

export function getShortBlockLabel(reason: TableBookingBlockReason): string {
  return SHORT_BLOCK_LABELS[reason];
}

export type NeedsLookItem<TTable> =
  | { kind: 'table'; table: TTable; label: string; fix: 'turn-on' | 'mark-available' }
  | { kind: 'zone'; zone: ZoneRef; tableCount: number };

/** Tables blocked in zones that are in service, then zones out of service that have tables. */
export function buildNeedsLookItems<TTable extends TableInventory>(
  tables: ReadonlyArray<TTable>,
  zones: ReadonlyArray<ZoneRef>,
  lookup: TableZoneLookup,
): NeedsLookItem<TTable>[] {
  const zoneOrder = new Map(zones.map((zone, index) => [zone.id, index]));
  const items: NeedsLookItem<TTable>[] = [];
  const blocked = tables
    // A zone out of service is listed once below, not table by table.
    .filter((table) => lookup.get(table.zoneId)?.active !== false)
    .sort(
      (a, b) =>
        (zoneOrder.get(a.zoneId) ?? 0) - (zoneOrder.get(b.zoneId) ?? 0) ||
        compareTableNumbers(a.tableNumber, b.tableNumber),
    );
  for (const table of blocked) {
    const status = getTableBookingStatus(table, lookup);
    if (status.bookable) continue;
    items.push({
      kind: 'table',
      table,
      label: getShortBlockLabel(status.reason),
      fix: status.reason === 'turned-off' ? 'turn-on' : 'mark-available',
    });
  }

  for (const zone of zones) {
    if (zone.active) continue;
    const tableCount = tables.filter((table) => table.zoneId === zone.id).length;
    if (tableCount > 0) items.push({ kind: 'zone', zone, tableCount });
  }
  return items;
}

/** Filled dots are party sizes the table takes; tables over eight seats show "+N". */
export function buildSeatDots(
  table: Pick<TableInventory, 'capacity' | 'minPartySize' | 'maxPartySize'>,
): { dots: boolean[]; overflow: number } {
  const smallest = table.minPartySize || 1;
  const largest = getTableLargestParty(table);
  const shown = Math.min(table.capacity, SEAT_DOT_LIMIT);
  return {
    dots: Array.from(
      { length: shown },
      (_, index) => index + 1 >= smallest && index + 1 <= largest,
    ),
    overflow: Math.max(0, table.capacity - SEAT_DOT_LIMIT),
  };
}

function optionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export type TileNote = { kind: 'join' } | { kind: 'text'; text: string };

/**
 * The one extra line on a bookable tile: a big table's note, "Can join" while its partner is
 * selected, or its fixed / seating / note facts.
 */
export function describeTileNote(
  table: Pick<TableInventory, 'capacity' | 'notes' | 'seatingType' | 'mobility'>,
  { joinable }: { joinable: boolean },
): TileNote | null {
  const notes = table.notes?.trim() ?? '';
  if (table.capacity >= BIG_TABLE_SEATS && notes) return { kind: 'text', text: notes };
  if (joinable) return { kind: 'join' };
  const parts = [
    isMovableTable(table) ? null : 'Fixed',
    table.seatingType !== 'standard'
      ? optionLabel(TABLE_SEATING_TYPE_OPTIONS, table.seatingType)
      : null,
    notes ? 'Has a note' : null,
  ].filter(Boolean);
  return parts.length > 0 ? { kind: 'text', text: parts.join(' · ') } : null;
}

/**
 * The add tile fills a gap in the last row of tiles; when it would sit alone on a new row it
 * becomes a slim full-width row instead.
 */
export function isAddTileAlone(capacities: ReadonlyArray<number>, columns: number): boolean {
  const cols = Math.max(1, columns);
  let column = 0;
  for (const seats of capacities) {
    const span = seats >= BIG_TABLE_SEATS ? Math.min(2, cols) : 1;
    if (column + span > cols) column = 0;
    column = (column + span) % cols;
  }
  return column === 0;
}

export type RoomShowFilter = TableBookableFilter;
export type RoomFilters = { query: string; show: RoomShowFilter };

export const DEFAULT_ROOM_FILTERS: RoomFilters = { query: '', show: 'all' };

export function matchesRoomFilters(
  table: TableInventory,
  filters: RoomFilters,
  zones: TableZoneLookup,
): boolean {
  if (filters.show !== 'all') {
    const bookable = getTableBookingStatus(table, zones).bookable;
    if ((filters.show === 'bookable') !== bookable) return false;
  }
  const needle = filters.query.trim().toLocaleLowerCase('en-GB');
  if (!needle) return true;
  return [
    table.tableNumber,
    table.notes ?? '',
    table.section ?? '',
    optionLabel(TABLE_SEATING_TYPE_OPTIONS, table.seatingType),
    optionLabel(TABLE_CATEGORY_OPTIONS, table.category),
  ]
    .join(' ')
    .toLocaleLowerCase('en-GB')
    .includes(needle);
}

export function hasRoomFilters(filters: RoomFilters): boolean {
  return filters.query.trim().length > 0 || filters.show !== 'all';
}

/**
 * Places a zone before another zone (or at the end when `beforeZoneId` is null) and returns the
 * sort orders that change, in the new order. A zone not yet saved is always included.
 */
export function planZoneOrder(
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'sortOrder'>>,
  zoneId: string,
  beforeZoneId: string | null,
): Array<{ zoneId: string; sortOrder: number }> {
  const current = new Map(zones.map((zone) => [zone.id, zone.sortOrder]));
  const others = zones.filter((zone) => zone.id !== zoneId).map((zone) => zone.id);
  const index = beforeZoneId === null ? -1 : others.indexOf(beforeZoneId);
  const ordered =
    index < 0 ? [...others, zoneId] : [...others.slice(0, index), zoneId, ...others.slice(index)];
  return ordered
    .map((id, sortOrder) => ({ zoneId: id, sortOrder }))
    .filter((item) => current.get(item.zoneId) !== item.sortOrder);
}

/** The zone a zone currently sits before, for the "Position on this page" select. */
export function getZoneSuccessorId(
  zones: ReadonlyArray<Pick<TableZone, 'id'>>,
  zoneId: string,
): string | null {
  const index = zones.findIndex((zone) => zone.id === zoneId);
  return index >= 0 ? (zones[index + 1]?.id ?? null) : null;
}
