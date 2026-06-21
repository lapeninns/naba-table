import { describe, expect, it } from 'vitest';

import {
  assertBookingZoneAllowsManualSelection,
  assertManualSelectionTablesAvailable,
  assertManualTableIds,
  assertManualTablesLoaded,
  resolveManualSelectionZoneId,
} from '@/server/capacity/table-assignment/manual-selection-preconditions';
import { ManualSelectionInputError } from '@/server/capacity/table-assignment/types';

import type { ManualSelectionSummary, Table } from '@/server/capacity/table-assignment/types';

function makeTable(overrides: Partial<Table> & { id: string }): Table {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    capacity: overrides.capacity ?? 2,
    zoneId: overrides.zoneId ?? 'zone-1',
    active: overrides.active ?? true,
    mobility: overrides.mobility ?? 'movable',
    status: overrides.status ?? 'available',
    zoneActive: overrides.zoneActive ?? true,
  };
}

function makeSummary(overrides: Partial<ManualSelectionSummary> = {}): ManualSelectionSummary {
  return {
    partySize: 4,
    slack: 0,
    tableCount: 2,
    tableNumbers: ['1', '2'],
    totalCapacity: 4,
    zoneId: 'zone-1',
    ...overrides,
  };
}

describe('manual selection preconditions', () => {
  it('rejects empty manual table selections', () => {
    expect(() => assertManualTableIds([])).toThrow(ManualSelectionInputError);
    try {
      assertManualTableIds([]);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'TABLES_REQUIRED',
        message: 'At least one table must be selected',
      });
    }
  });

  it('rejects incomplete selected table loads with the caller message', () => {
    try {
      assertManualTablesLoaded({
        loadedCount: 1,
        message: 'Selected tables could not be loaded',
        requestedCount: 2,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'TABLE_LOOKUP_FAILED',
        message: 'Selected tables could not be loaded',
      });
    }
  });

  it('rejects selections outside an assigned booking zone', () => {
    try {
      assertBookingZoneAllowsManualSelection({
        assignedZoneId: 'zone-2',
        summary: makeSummary({ zoneId: 'zone-1' }),
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'ZONE_LOCKED',
        status: 409,
        message: 'Booking is locked to zone zone-2; selected zone zone-1 is not allowed',
      });
    }
  });

  it('rejects inactive, disabled-zone, and out-of-service tables', () => {
    try {
      assertManualSelectionTablesAvailable([
        makeTable({ id: 'table-1', active: false, tableNumber: '1' }),
        makeTable({ id: 'table-2', zoneActive: false, tableNumber: '2' }),
        makeTable({ id: 'table-3', status: 'out_of_service', tableNumber: '3' }),
      ]);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'RESOURCE_DISABLED',
        status: 409,
        message: 'Selected tables are inactive or in a disabled zone: 1, 2, 3',
      });
    }
  });

  it('resolves summary zone first and table zone second', () => {
    expect(
      resolveManualSelectionZoneId({
        summary: makeSummary({ zoneId: 'zone-summary' }),
        tables: [makeTable({ id: 'table-1', zoneId: 'zone-table' })],
      }),
    ).toBe('zone-summary');

    expect(
      resolveManualSelectionZoneId({
        summary: makeSummary({ zoneId: null }),
        tables: [makeTable({ id: 'table-1', zoneId: 'zone-table' })],
      }),
    ).toBe('zone-table');
  });

  it('rejects selections without a resolvable zone id', () => {
    try {
      resolveManualSelectionZoneId({
        summary: makeSummary({ zoneId: null }),
        tables: [makeTable({ id: 'table-1', zoneId: null })],
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'ZONE_REQUIRED',
        message: 'Unable to determine zone for selected tables',
      });
    }
  });
});
