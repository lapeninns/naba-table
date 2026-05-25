import { describe, expect, it } from 'vitest';

import {
  buildTableInventoryCommandMetrics,
  buildTableInventorySummaryCards,
  formatTablePartySize,
  formatTableSeatingType,
  formatTableStatus,
  getTableAvailabilityLabel,
  getTableInventoryDesktopEmptyMessage,
  getTableInventoryEmptyMessage,
  isTableServiceReady,
} from '@/components/features/tables/tableInventoryDisplayDomain';
import {
  buildTableFormDraft,
  buildTableInventoryZoneOptions,
  buildTableInventoryZones,
  getSelectedTableZone,
  parseTableFormPayload,
} from '@/components/features/tables/tableInventoryFormDomain';

import type { TableInventory, TableInventorySummary } from '@/services/ops/tables';

describe('tableInventoryDomain table form helpers', () => {
  it('builds initial form drafts from the table or the first active zone', () => {
    const zones = [
      { id: 'inactive-zone', active: false },
      { id: 'active-zone', active: true },
    ];

    expect(buildTableFormDraft(null, zones)).toMatchObject({
      zoneId: 'active-zone',
      category: 'dining',
      seatingType: 'standard',
      mobility: 'movable',
      status: 'available',
      active: true,
    });
    expect(buildTableFormDraft(table(), zones)).toMatchObject({
      zoneId: 'table-zone',
      category: 'patio',
      seatingType: 'booth',
      mobility: 'fixed',
      status: 'out_of_service',
      active: false,
    });
  });

  it('finds the selected zone without leaking lookup logic into the form', () => {
    const zones = [
      { id: 'zone-1', name: 'Main' },
      { id: 'zone-2', name: 'Patio' },
    ];

    expect(getSelectedTableZone(zones, 'zone-2')).toEqual({ id: 'zone-2', name: 'Patio' });
    expect(getSelectedTableZone(zones, undefined)).toBeNull();
    expect(getSelectedTableZone(zones, 'missing')).toBeNull();
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

  it('normalizes table inventory display labels outside the renderer', () => {
    expect(formatTablePartySize({ minPartySize: 2, maxPartySize: 6 })).toBe('2–6');
    expect(formatTablePartySize({ minPartySize: 4, maxPartySize: null })).toBe('4+');
    expect(formatTableStatus('out_of_service')).toBe('out of service');
    expect(formatTableSeatingType('high_top')).toBe('high top');

    expect(isTableServiceReady({ active: true, zoneActive: true })).toBe(true);
    expect(isTableServiceReady({ active: true, zoneActive: false })).toBe(false);
    expect(getTableAvailabilityLabel({ active: true, zoneActive: true })).toBe('Active');
    expect(getTableAvailabilityLabel({ active: true, zoneActive: false })).toBe('Blocked by zone');
    expect(getTableAvailabilityLabel({ active: false, zoneActive: true })).toBe('Inactive');
  });

  it('builds command metrics and summary cards from service-ready tables', () => {
    const summary: TableInventorySummary = {
      totalTables: 3,
      totalCapacity: 10,
      availableTables: 2,
      zones: [
        { id: 'main', name: 'Main', active: true, sortOrder: 1 },
        { id: 'patio', name: 'Patio', active: false, sortOrder: 2 },
      ],
      serviceCapacities: [
        {
          key: 'dinner',
          label: 'Dinner',
          capacity: 16,
          tablesConsidered: 2,
          turnsPerTable: 2,
        },
      ],
    };
    const tables = [
      table({ id: 'ready-1', capacity: 4, active: true, zoneActive: true }),
      table({ id: 'ready-2', capacity: 2, active: true, zoneActive: true }),
      table({ id: 'blocked', capacity: 4, active: true, zoneActive: false }),
    ];

    expect(buildTableInventoryCommandMetrics(summary, tables)).toEqual([
      {
        key: 'bookable-tables',
        label: 'Bookable tables',
        value: '2 tables',
        description: '6 covers',
        variant: 'secondary',
      },
      {
        key: 'zones',
        label: 'Zones',
        value: '2',
        description: 'floor-plan groups',
        variant: 'outline',
      },
      {
        key: 'inventory-total',
        label: 'Inventory total',
        value: '3 tables',
        description: '10 planned covers',
        variant: 'metric',
      },
    ]);

    expect(buildTableInventorySummaryCards(summary, tables)).toEqual([
      {
        key: 'ready-for-bookings',
        label: 'Ready for bookings',
        value: '2 active tables, 6 covers',
        description: 'Active tables in active zones can be booked.',
      },
      {
        key: 'inventory-total',
        label: 'Inventory total',
        value: '3 tables',
        description: '10 planned covers across all table records',
      },
      {
        key: 'inactive-tables',
        label: 'Needs attention',
        value: '1 tables',
        description: '1 inactive',
      },
      {
        key: 'zones-configured',
        label: 'Zones configured',
        value: '2',
        description: '1 inactive',
      },
      {
        key: 'service-dinner',
        label: 'Dinner',
        value: '16 covers',
        description: '≈2 turns across 2 tables',
      },
    ]);
  });

  it('keeps mobile and desktop empty-state copy deterministic', () => {
    expect(getTableInventoryEmptyMessage(0)).toBe(
      'Add your first tables. Start with table number and capacity; advanced details can come later.',
    );
    expect(getTableInventoryDesktopEmptyMessage(0)).toBe(
      'No table records yet. Add tables with number and capacity first; advanced details can come later.',
    );
    expect(getTableInventoryEmptyMessage(3)).toBe(
      'No tables match this filter. Try showing all zones or tables.',
    );
    expect(getTableInventoryDesktopEmptyMessage(3)).toBe(
      'No tables match this filter. Try showing all zones or tables.',
    );
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

  it('returns explicit validation errors for invalid form data', () => {
    const emptyTableNumber = new FormData();
    emptyTableNumber.set('capacity', '4');

    expect(parseTableFormPayload(emptyTableNumber, draft())).toEqual({
      ok: false,
      error: 'Enter a table number before saving.',
    });

    const invalidCapacity = new FormData();
    invalidCapacity.set('tableNumber', '1');
    invalidCapacity.set('capacity', '0');

    expect(parseTableFormPayload(invalidCapacity, draft())).toEqual({
      ok: false,
      error: 'Capacity must be at least 1 cover.',
    });

    const missingZone = new FormData();
    missingZone.set('tableNumber', '1');
    missingZone.set('capacity', '2');

    expect(parseTableFormPayload(missingZone, { ...draft(), zoneId: undefined })).toEqual({
      ok: false,
      error: 'Choose a zone before saving this table.',
    });

    const invalidPartyRange = new FormData();
    invalidPartyRange.set('tableNumber', '1');
    invalidPartyRange.set('capacity', '2');
    invalidPartyRange.set('minPartySize', '4');
    invalidPartyRange.set('maxPartySize', '3');

    expect(parseTableFormPayload(invalidPartyRange, draft())).toEqual({
      ok: false,
      error: 'Max party size must be greater than or equal to the min party size.',
    });
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

function table(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-1',
    restaurantId: 'rest-1',
    tableNumber: '1',
    capacity: 4,
    minPartySize: 1,
    maxPartySize: null,
    section: null,
    category: 'patio',
    seatingType: 'booth',
    mobility: 'fixed',
    zoneId: 'table-zone',
    zoneName: 'Main',
    zoneActive: true,
    active: false,
    status: 'out_of_service',
    position: null,
    notes: null,
    ...overrides,
  };
}
