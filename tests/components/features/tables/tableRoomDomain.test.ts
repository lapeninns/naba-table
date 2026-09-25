import { describe, expect, it } from 'vitest';

import { buildTableZoneLookup } from '@/components/features/tables/tableInventoryDisplayDomain';
import {
  buildNeedsLookItems,
  buildPartyCoverage,
  buildSeatDots,
  buildSeatStats,
  describeTileNote,
  getJoinPartners,
  getShortBlockLabel,
  getZoneJoinSummary,
  isAddTileAlone,
  matchesRoomFilters,
  planZoneOrder,
  TABLE_JOIN_MAX_TABLES,
} from '@/components/features/tables/tableRoomDomain';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'main', name: 'Main dining room', active: true, sortOrder: 0 },
  { id: 'bar', name: 'Bar', active: true, sortOrder: 1 },
  { id: 'garden', name: 'Garden terrace', active: false, sortOrder: 2 },
];
const lookup = buildTableZoneLookup(zones);

describe('table joining', () => {
  it('joins movable, bookable tables in the same zone, up to the allocator limit', () => {
    const tables = [
      table({ id: 'a', tableNumber: '1', capacity: 2 }),
      table({ id: 'b', tableNumber: '2', capacity: 4 }),
      table({ id: 'c', tableNumber: '3', capacity: 6, mobility: 'fixed' }),
      table({ id: 'd', tableNumber: '4', capacity: 4, status: 'out_of_service' }),
      table({ id: 'e', tableNumber: 'B1', capacity: 2, zoneId: 'bar' }),
    ];

    expect(getJoinPartners(tables[0]!, tables, lookup).map((t) => t.id)).toEqual(['b']);
    expect(getJoinPartners(tables[2]!, tables, lookup)).toEqual([]);
    expect(getJoinPartners(tables[3]!, tables, lookup)).toEqual([]);

    expect(getZoneJoinSummary(tables, 'main', lookup)).toEqual({
      joinableCount: 2,
      maxTables: 2,
      maxParty: 6,
      fixedCount: 1,
    });
    expect(getZoneJoinSummary(tables, 'bar', lookup)).toMatchObject({ maxParty: 0, maxTables: 0 });
  });

  it('adds up only the largest tables the allocator can join together', () => {
    const tables = Array.from({ length: TABLE_JOIN_MAX_TABLES + 2 }, (_, index) =>
      table({ id: `t${index}`, tableNumber: String(index + 1), capacity: index + 1 }),
    );
    const largest = tables
      .map((t) => t.capacity)
      .sort((a, b) => b - a)
      .slice(0, TABLE_JOIN_MAX_TABLES)
      .reduce((sum, n) => sum + n, 0);

    expect(getZoneJoinSummary(tables, 'main', lookup)).toMatchObject({
      maxTables: TABLE_JOIN_MAX_TABLES,
      maxParty: largest,
    });
  });
});

describe('seat stats and coverage', () => {
  it('counts bookable seats against every seat', () => {
    const tables = [
      table({ id: 'a', capacity: 2 }),
      table({ id: 'b', capacity: 4, active: false }),
      table({ id: 'c', capacity: 6, zoneId: 'garden' }),
    ];

    expect(buildSeatStats(tables, lookup)).toEqual({
      bookableSeats: 2,
      totalSeats: 12,
      bookableTables: 1,
      totalTables: 3,
    });
  });

  it('counts single tables per party size and marks sizes reachable only by joining', () => {
    const tables = [
      table({ id: 'a', tableNumber: '1', capacity: 2, minPartySize: 1, maxPartySize: 2 }),
      table({ id: 'b', tableNumber: '2', capacity: 4, minPartySize: 2, maxPartySize: 4 }),
      table({ id: 'c', tableNumber: '3', capacity: 4, minPartySize: 3, maxPartySize: null }),
    ];

    const coverage = buildPartyCoverage(tables, zones, lookup);

    expect(coverage.sizes.slice(0, 5).map((size) => size.count)).toEqual([1, 2, 2, 2, 0]);
    expect(coverage.sizes[11]).toMatchObject({ label: '12+' });
    expect(coverage.largestSingle).toBe(4);
    expect(coverage.joinTop).toEqual({ maxParty: 10, zoneName: 'Main dining room' });
    expect(coverage.sizes[4]).toMatchObject({ size: 5, count: 0, joinOnly: true });
    expect(coverage.sizes[10]).toMatchObject({ size: 11, count: 0, joinOnly: false });
    expect(coverage.gaps).toEqual([]);
  });

  it('lists party sizes no single table or join takes', () => {
    const tables = [
      table({ id: 'a', capacity: 2, maxPartySize: 2, mobility: 'fixed' }),
      table({ id: 'b', capacity: 6, minPartySize: 5, maxPartySize: 6, mobility: 'fixed' }),
    ];

    expect(buildPartyCoverage(tables, zones, lookup).gaps).toEqual([3, 4]);
  });
});

describe('needs a look', () => {
  it('lists blocked tables in zones in service, then zones out of service with tables', () => {
    const tables = [
      table({ id: 'a', tableNumber: '8', status: 'out_of_service' }),
      table({ id: 'b', tableNumber: 'B3', zoneId: 'bar', active: false }),
      table({ id: 'c', tableNumber: 'G1', zoneId: 'garden' }),
      table({ id: 'd', tableNumber: 'G2', zoneId: 'garden', active: false }),
    ];

    expect(buildNeedsLookItems(tables, zones, lookup)).toEqual([
      { kind: 'table', table: tables[0], label: 'Out of service', fix: 'mark-available' },
      { kind: 'table', table: tables[1], label: 'Turned off', fix: 'turn-on' },
      { kind: 'zone', zone: zones[2], tableCount: 2 },
    ]);
  });

  it('uses short block labels', () => {
    expect(getShortBlockLabel('turned-off')).toBe('Turned off');
    expect(getShortBlockLabel('zone-out-of-service')).toBe('Zone off');
    expect(getShortBlockLabel('out-of-service')).toBe('Out of service');
  });
});

describe('tiles', () => {
  it('draws up to eight seat dots, filling the party sizes the table takes', () => {
    expect(buildSeatDots(table({ capacity: 4, minPartySize: 2, maxPartySize: 3 }))).toEqual({
      dots: [false, true, true, false],
      overflow: 0,
    });
    expect(buildSeatDots(table({ capacity: 10 })).overflow).toBe(2);
  });

  it('describes a tile by its most useful note', () => {
    expect(describeTileNote(table(), { joinable: false })).toBeNull();
    expect(describeTileNote(table(), { joinable: true })).toEqual({ kind: 'join' });
    expect(
      describeTileNote(table({ mobility: 'fixed', seatingType: 'booth', notes: 'Window' }), {
        joinable: false,
      }),
    ).toEqual({ kind: 'text', text: 'Fixed · Booth · Has a note' });
    expect(describeTileNote(table({ capacity: 8, notes: 'Seats 9' }), { joinable: true })).toEqual({
      kind: 'text',
      text: 'Seats 9',
    });
  });

  it('turns the add tile into a slim row when it would sit alone', () => {
    // Three columns: two small tables leave room for the add tile on the same row.
    expect(isAddTileAlone([2, 4], 3)).toBe(false);
    expect(isAddTileAlone([2, 4, 4], 3)).toBe(true);
    // A big table spans two columns.
    expect(isAddTileAlone([8, 2], 3)).toBe(true);
    // An empty zone shows only the slim add row.
    expect(isAddTileAlone([], 3)).toBe(true);
  });
});

describe('room filters', () => {
  it('matches search on number, notes, section, seating and category, and the bookable filter', () => {
    const booth = table({ tableNumber: '5', seatingType: 'booth', section: 'Window' });

    expect(matchesRoomFilters(booth, { query: 'booth', show: 'all' }, lookup)).toBe(true);
    expect(matchesRoomFilters(booth, { query: 'window', show: 'all' }, lookup)).toBe(true);
    expect(matchesRoomFilters(booth, { query: 'patio', show: 'all' }, lookup)).toBe(false);
    expect(matchesRoomFilters(booth, { query: '', show: 'not-bookable' }, lookup)).toBe(false);
  });
});

describe('zone order', () => {
  it('moves a zone before another and renumbers only the zones that change', () => {
    expect(planZoneOrder(zones, 'garden', 'main')).toEqual([
      { zoneId: 'garden', sortOrder: 0 },
      { zoneId: 'main', sortOrder: 1 },
      { zoneId: 'bar', sortOrder: 2 },
    ]);
    expect(planZoneOrder(zones, 'main', null)).toEqual([
      { zoneId: 'bar', sortOrder: 0 },
      { zoneId: 'garden', sortOrder: 1 },
      { zoneId: 'main', sortOrder: 2 },
    ]);
    expect(planZoneOrder(zones, 'bar', 'garden')).toEqual([]);
  });

  it('places a new zone without renumbering the others when it goes at the end', () => {
    expect(planZoneOrder(zones, 'new', null)).toEqual([{ zoneId: 'new', sortOrder: 3 }]);
  });
});

function table(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '1',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'dining',
    seatingType: 'standard',
    mobility: 'movable',
    zoneId: 'main',
    zoneName: 'Main dining room',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
    ...overrides,
  };
}
