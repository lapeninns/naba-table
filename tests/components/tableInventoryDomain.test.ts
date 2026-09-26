import { describe, expect, it } from 'vitest';

import {
  buildServiceCapacityLines,
  buildTableInventoryOverview,
  buildTableZoneLookup,
  compareTableNumbers,
  DEFAULT_TABLE_LIST_FILTERS,
  describeNotBookableReasons,
  describeZonesInService,
  filterTableInventory,
  formatTableDetails,
  formatTablePartySize,
  formatZoneTableStats,
  getTableBookingStatus,
  getTableListEmptyState,
  getZoneTableStats,
  groupTablesByZone,
  hasActiveTableFilters,
  matchesTableSearch,
} from '@/components/features/tables/tableInventoryDisplayDomain';
import {
  buildTableFormDraft,
  buildTableInventoryZoneOptions,
  buildTableInventoryZones,
  getDuplicateTableNumberMessage,
  getFirstInvalidTableField,
  getSelectedTableZone,
  parseTableFormPayload,
  parseZoneFormPayload,
} from '@/components/features/tables/tableInventoryFormDomain';
import { ALL_ZONES_VALUE } from '@/components/features/tables/tableInventoryModel';

import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

const zones = [
  { id: 'main', name: 'Main dining room', active: true, sortOrder: 0 },
  { id: 'bar', name: 'Bar', active: true, sortOrder: 1 },
  { id: 'garden', name: 'Garden terrace', active: false, sortOrder: 2 },
];

describe('computed Bookings status', () => {
  it('is bookable only when the table is on, its zone is in service and it is not out of service', () => {
    expect(getTableBookingStatus(table())).toEqual({
      bookable: true,
      reason: null,
      label: 'Bookable',
    });
  });

  it('names the first reason a table cannot be booked, in a fixed order', () => {
    const lookup = buildTableZoneLookup(zones);

    expect(getTableBookingStatus(table({ active: false, zoneId: 'garden' }), lookup)).toMatchObject(
      { bookable: false, reason: 'turned-off', label: 'Not bookable: turned off' },
    );
    expect(getTableBookingStatus(table({ zoneId: 'garden' }), lookup)).toMatchObject({
      bookable: false,
      reason: 'zone-out-of-service',
      label: 'Not bookable: Garden terrace is out of service',
    });
    expect(getTableBookingStatus(table({ status: 'out_of_service' }), lookup)).toMatchObject({
      bookable: false,
      reason: 'out-of-service',
      label: 'Not bookable: marked out of service',
    });
  });

  it('treats reserved and occupied as notes that do not stop bookings', () => {
    expect(getTableBookingStatus(table({ status: 'reserved' })).bookable).toBe(true);
    expect(getTableBookingStatus(table({ status: 'occupied' })).bookable).toBe(true);
  });

  it('reads zone state from the zones list before the table row, so zone switches apply at once', () => {
    const lookup = buildTableZoneLookup([{ id: 'main', name: 'Main', active: false }]);
    expect(getTableBookingStatus(table({ zoneActive: true }), lookup).bookable).toBe(false);
    expect(getTableBookingStatus(table({ zoneActive: false, zoneName: 'Main' })).label).toBe(
      'Not bookable: Main is out of service',
    );
  });
});

describe('tables list filtering', () => {
  const tables = [
    table({ id: 't1', tableNumber: '1', zoneId: 'main', notes: 'Window seat' }),
    table({ id: 't2', tableNumber: '12', zoneId: 'main', active: false }),
    table({ id: 't3', tableNumber: 'B1', zoneId: 'bar', notes: null }),
    table({ id: 't4', tableNumber: 'G1', zoneId: 'garden' }),
  ];
  const lookup = buildTableZoneLookup(zones);

  it('searches by table number or note, ignoring case and spaces around the query', () => {
    expect(matchesTableSearch(tables[0], '  WINDOW ')).toBe(true);
    expect(matchesTableSearch(tables[2], 'b1')).toBe(true);
    expect(matchesTableSearch(tables[2], 'window')).toBe(false);
    expect(matchesTableSearch(tables[2], '')).toBe(true);
  });

  it('combines zone, bookable and search filters', () => {
    const ids = (filters: Partial<typeof DEFAULT_TABLE_LIST_FILTERS>) =>
      filterTableInventory(tables, { ...DEFAULT_TABLE_LIST_FILTERS, ...filters }, lookup).map(
        (item) => item.id,
      );

    expect(ids({})).toEqual(['t1', 't2', 't3', 't4']);
    expect(ids({ zoneId: 'main' })).toEqual(['t1', 't2']);
    expect(ids({ bookable: 'bookable' })).toEqual(['t1', 't3']);
    expect(ids({ bookable: 'not-bookable' })).toEqual(['t2', 't4']);
    expect(ids({ query: '1' })).toEqual(['t1', 't2', 't3', 't4']);
    expect(ids({ query: '12', bookable: 'not-bookable' })).toEqual(['t2']);
  });

  it('knows when any filter is active', () => {
    expect(hasActiveTableFilters(DEFAULT_TABLE_LIST_FILTERS)).toBe(false);
    expect(hasActiveTableFilters({ ...DEFAULT_TABLE_LIST_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveTableFilters({ ...DEFAULT_TABLE_LIST_FILTERS, query: '4' })).toBe(true);
    expect(hasActiveTableFilters({ ...DEFAULT_TABLE_LIST_FILTERS, zoneId: 'bar' })).toBe(true);
    expect(hasActiveTableFilters({ ...DEFAULT_TABLE_LIST_FILTERS, bookable: 'bookable' })).toBe(
      true,
    );
    expect(DEFAULT_TABLE_LIST_FILTERS.zoneId).toBe(ALL_ZONES_VALUE);
  });

  it('groups tables by zone in zone order and sorts table numbers naturally', () => {
    const grouped = groupTablesByZone(
      [
        table({ id: 'a', tableNumber: '10', zoneId: 'main' }),
        table({ id: 'b', tableNumber: '2', zoneId: 'main' }),
        table({ id: 'c', tableNumber: 'B1', zoneId: 'bar' }),
        table({ id: 'd', tableNumber: 'X', zoneId: 'unknown', zoneName: 'Old zone' }),
      ],
      zones,
    );

    expect(grouped.map((group) => [group.zoneName, group.tables.map((item) => item.id)])).toEqual([
      ['Main dining room', ['b', 'a']],
      ['Bar', ['c']],
      ['Old zone', ['d']],
    ]);
    expect(compareTableNumbers('2', '10')).toBeLessThan(0);
  });
});

describe('tables summary', () => {
  it('counts bookable tables and seats, and not bookable tables by reason', () => {
    const overview = buildTableInventoryOverview(
      [
        table({ capacity: 2 }),
        table({ capacity: 4 }),
        table({ active: false }),
        table({ zoneId: 'garden' }),
        table({ zoneId: 'garden', active: false }),
        table({ status: 'out_of_service' }),
      ],
      zones,
    );

    expect(overview).toMatchObject({
      totalTables: 6,
      bookableTables: 2,
      bookableSeats: 6,
      notBookableTables: 4,
      notBookableReasons: { 'turned-off': 2, 'zone-out-of-service': 1, 'out-of-service': 1 },
      zoneCount: 3,
      zonesOutOfService: 1,
    });
    expect(describeNotBookableReasons(overview)).toBe(
      '2 turned off · 1 in a zone out of service · 1 marked out of service',
    );
    expect(describeZonesInService(overview)).toBe('1 out of service');
  });

  it('words empty and fully bookable summaries', () => {
    const empty = buildTableInventoryOverview([], []);
    expect(describeNotBookableReasons(empty)).toBe('No tables yet');
    expect(describeZonesInService(empty)).toBe('No zones yet');

    const allBookable = buildTableInventoryOverview([table()], [zones[0]]);
    expect(describeNotBookableReasons(allBookable)).toBe('Every table can be booked');
    expect(describeZonesInService(allBookable)).toBe('All in service');
  });

  it('shows the server per-service capacity, not an estimate', () => {
    const summary: Pick<TableInventorySummary, 'serviceCapacities'> = {
      serviceCapacities: [
        serviceCapacity({ key: 'lunch', label: 'Lunch', capacity: 1, turnsPerTable: 0 }),
        serviceCapacity({ key: 'dinner', label: 'Dinner', capacity: 16, turnsPerTable: 2 }),
      ],
    };

    expect(buildServiceCapacityLines(summary)).toEqual([
      {
        key: 'lunch',
        label: 'Lunch',
        value: '1 cover',
        description: 'The meal time is shorter than one turn',
      },
      {
        key: 'dinner',
        label: 'Dinner',
        value: '16 covers',
        description: 'About 2 turns per table · 8 tables',
      },
    ]);
    expect(buildServiceCapacityLines(null)).toEqual([]);
  });

  it('describes a zone by its tables and seats', () => {
    const stats = getZoneTableStats(
      [table({ capacity: 2 }), table({ capacity: 4 }), table({ zoneId: 'bar', capacity: 6 })],
      'main',
    );
    expect(stats).toEqual({ tableCount: 2, seatCount: 6 });
    expect(formatZoneTableStats(stats)).toBe('2 tables · 6 seats');
    expect(formatZoneTableStats({ tableCount: 1, seatCount: 1 })).toBe('1 table · 1 seat');
  });
});

describe('table display helpers', () => {
  it('shows the party size range, using seats when there is no largest party', () => {
    expect(formatTablePartySize({ minPartySize: 2, maxPartySize: 6, capacity: 6 })).toBe('2–6');
    expect(formatTablePartySize({ minPartySize: 1, maxPartySize: null, capacity: 4 })).toBe('1–4');
    expect(formatTablePartySize({ minPartySize: 2, maxPartySize: 2, capacity: 2 })).toBe('2');
  });

  it('lists only details that differ from the defaults', () => {
    expect(formatTableDetails(table())).toBe('');
    expect(
      formatTableDetails(
        table({ seatingType: 'high_top', mobility: 'fixed', section: 'Window', notes: 'Wobbly' }),
      ),
    ).toBe('High-top · Fixed · Window · Wobbly');
  });

  it('picks the right empty state for the tables list', () => {
    expect(getTableListEmptyState(3, 1)).toEqual({
      title: 'No tables match',
      description: 'Try another zone, search or filter.',
      action: 'clear-filters',
    });
    expect(getTableListEmptyState(0, 1)).toMatchObject({
      title: 'No tables yet',
      action: 'add-table',
    });
    expect(getTableListEmptyState(0, 0)).toEqual({
      title: 'No tables yet',
      description: 'Add a zone first, then your tables.',
      action: null,
    });
  });
});

describe('tableInventoryDomain table form helpers', () => {
  it('builds initial form drafts from the table, the preferred zone or the first active zone', () => {
    const draftZones = [
      { id: 'inactive-zone', active: false },
      { id: 'active-zone', active: true },
    ];

    expect(buildTableFormDraft(null, draftZones)).toMatchObject({
      zoneId: 'active-zone',
      category: 'dining',
      seatingType: 'standard',
      mobility: 'movable',
      status: 'available',
      active: true,
    });
    expect(buildTableFormDraft(null, draftZones, 'inactive-zone').zoneId).toBe('inactive-zone');
    expect(buildTableFormDraft(null, draftZones, 'missing').zoneId).toBe('active-zone');
    expect(
      buildTableFormDraft(
        table({
          zoneId: 'table-zone',
          category: 'patio',
          seatingType: 'booth',
          mobility: 'fixed',
          status: 'out_of_service',
          active: false,
        }),
        draftZones,
      ),
    ).toMatchObject({
      zoneId: 'table-zone',
      category: 'patio',
      seatingType: 'booth',
      mobility: 'fixed',
      status: 'out_of_service',
      active: false,
    });
  });

  it('finds the selected zone without leaking lookup logic into the form', () => {
    const list = [
      { id: 'zone-1', name: 'Main' },
      { id: 'zone-2', name: 'Patio' },
    ];

    expect(getSelectedTableZone(list, 'zone-2')).toEqual({ id: 'zone-2', name: 'Patio' });
    expect(getSelectedTableZone(list, undefined)).toBeNull();
    expect(getSelectedTableZone(list, 'missing')).toBeNull();
  });

  it('normalizes summary zones before fallback zones and sorts by order then name', () => {
    const summary: TableInventorySummary = {
      totalTables: 0,
      totalCapacity: 0,
      availableTables: 0,
      zones: [
        { id: 'patio', name: 'Patio', active: true, sortOrder: 20 },
        { id: 'bar', name: 'Bar', active: false, sortOrder: 10 },
        { id: 'atrium', name: 'Atrium', active: true, sortOrder: 10 },
      ],
      serviceCapacities: [],
    };

    expect(
      buildTableInventoryZones(summary, [{ id: 'fallback', name: 'Fallback', active: true }]),
    ).toEqual([
      { id: 'atrium', name: 'Atrium', active: true, sortOrder: 10 },
      { id: 'bar', name: 'Bar', active: false, sortOrder: 10 },
      { id: 'patio', name: 'Patio', active: true, sortOrder: 20 },
    ]);

    expect(
      buildTableInventoryZones(null, [
        { id: 'late', name: 'Late', active: true, sortOrder: 30 },
        { id: 'early', name: 'Early', active: false, sortOrder: 1 },
      ]),
    ).toEqual([
      { id: 'early', name: 'Early', active: false, sortOrder: 1 },
      { id: 'late', name: 'Late', active: true, sortOrder: 30 },
    ]);
  });

  it('builds compact zone options from normalized zones', () => {
    expect(
      buildTableInventoryZoneOptions([
        { id: 'main', name: 'Main', active: true, sortOrder: 1 },
        { id: 'closed', name: 'Closed', active: false, sortOrder: 2 },
      ]),
    ).toEqual([
      { id: 'main', name: 'Main', active: true },
      { id: 'closed', name: 'Closed', active: false },
    ]);
  });

  it('parses valid form data into a normalized table payload', () => {
    const formData = new FormData();
    formData.set('tableNumber', '  A12  ');
    formData.set('capacity', '4');
    formData.set('minPartySize', '2');
    formData.set('maxPartySize', '6');
    formData.set('section', ' Patio ');
    formData.set('notes', ' Window side ');

    expect(
      parseTableFormPayload(formData, {
        zoneId: 'zone-main',
        category: 'private',
        seatingType: 'high_top',
        mobility: 'movable',
        status: 'available',
        active: true,
      }),
    ).toEqual({
      ok: true,
      payload: {
        tableNumber: 'A12',
        capacity: 4,
        minPartySize: 2,
        maxPartySize: 6,
        section: 'Patio',
        notes: 'Window side',
        zoneId: 'zone-main',
        category: 'private',
        seatingType: 'high_top',
        mobility: 'movable',
        status: 'available',
        active: true,
      },
    });
  });

  it('defaults an empty smallest party to 1 and an empty largest party to seats', () => {
    const formData = new FormData();
    formData.set('tableNumber', '3');
    formData.set('capacity', '2');
    formData.set('minPartySize', '');
    formData.set('maxPartySize', '');

    const result = parseTableFormPayload(formData, draft());
    expect(result).toMatchObject({ ok: true, payload: { minPartySize: 1, maxPartySize: null } });
  });

  it('returns field errors that restate the server rules', () => {
    const formData = new FormData();
    formData.set('tableNumber', '   ');
    formData.set('capacity', '21');
    formData.set('minPartySize', '4');
    formData.set('maxPartySize', '3');
    formData.set('notes', 'x'.repeat(501));

    const result = parseTableFormPayload(formData, { ...draft(), zoneId: undefined });
    expect(result).toEqual({
      ok: false,
      errors: {
        tableNumber: 'Enter a table number',
        capacity: 'Enter seats from 1 to 20',
        maxPartySize: 'Largest party must be at least the smallest party, up to 20',
        zoneId: 'Choose a zone',
        notes: 'Use 500 characters or fewer',
      },
    });
    if (!result.ok) {
      expect(getFirstInvalidTableField(result.errors)).toBe('tableNumber');
    }

    const zeroSeats = new FormData();
    zeroSeats.set('tableNumber', '1');
    zeroSeats.set('capacity', '0');
    zeroSeats.set('maxPartySize', '25');
    expect(parseTableFormPayload(zeroSeats, draft())).toEqual({
      ok: false,
      errors: {
        capacity: 'Enter seats from 1 to 20',
        maxPartySize: 'Largest party must be at least the smallest party, up to 20',
      },
    });
    expect(getFirstInvalidTableField({})).toBeNull();
  });

  it('words the duplicate table number error from the server conflict', () => {
    expect(getDuplicateTableNumberMessage(' 12 ')).toBe('Table 12 already exists');
  });

  it('requires a unique zone name and keeps the chosen position', () => {
    const existing = [
      { id: 'main', name: 'Main dining room' },
      { id: 'bar', name: 'Bar' },
    ];

    expect(parseZoneFormPayload({ name: '  ', beforeZoneId: null }, existing, null)).toEqual({
      ok: false,
      errors: { zoneName: 'Enter a zone name' },
    });
    expect(parseZoneFormPayload({ name: ' bar ', beforeZoneId: null }, existing, null)).toEqual({
      ok: false,
      errors: { zoneName: 'A zone with this name already exists' },
    });
    expect(parseZoneFormPayload({ name: 'Bar', beforeZoneId: 'main' }, existing, 'bar')).toEqual({
      ok: true,
      payload: { name: 'Bar', beforeZoneId: 'main' },
    });
    expect(parseZoneFormPayload({ name: ' Terrace ', beforeZoneId: null }, existing, null)).toEqual(
      { ok: true, payload: { name: 'Terrace', beforeZoneId: null } },
    );
  });
});

function draft() {
  return {
    zoneId: 'zone-main',
    category: 'dining' as const,
    seatingType: 'standard' as const,
    mobility: 'movable' as const,
    status: 'available' as const,
    active: true,
  };
}

function serviceCapacity(
  overrides: Partial<TableInventorySummary['serviceCapacities'][number]>,
): TableInventorySummary['serviceCapacities'][number] {
  return {
    key: 'dinner',
    label: 'Dinner',
    capacity: 0,
    tablesConsidered: 8,
    turnsPerTable: 0,
    seatsPerTurn: 32,
    assumptions: { windowMinutes: 240, turnMinutes: 90, bufferMinutes: 15, intervalMinutes: 15 },
    ...overrides,
  };
}

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
