import { describe, expect, it } from 'vitest';

import {
  buildTableAssignmentInventoryView,
  createDefaultTableAssignmentFilters,
  filterAndSortAssignmentTables,
  getTableAssignmentZoneOptions,
  parseTableAssignmentTimeline,
  type TableAssignmentFilterState,
} from '@src/components/features/dashboard/booking-details/tableAssignmentPanelDomain';

import type {
  AssignmentContext,
  ManualAssignmentTable,
} from '@src/components/features/dashboard/booking-details/types';

const baseFilters: TableAssignmentFilterState = {
  availabilityOnly: false,
  fitFilter: 'all',
  sortBy: 'best',
  zoneFilter: 'all',
};

const tables: ManualAssignmentTable[] = [
  table({ id: 't-window', capacity: 4, section: 'Window', tableNumber: '20' }),
  table({ id: 't-main', capacity: 2, section: null, tableNumber: '2' }),
  table({ id: 't-booth', capacity: 7, section: 'Booth', tableNumber: '10' }),
  table({ id: 't-conflict', capacity: 5, section: 'Booth', tableNumber: '11' }),
  table({ id: 't-inactive', active: false, capacity: 4, section: 'Patio', tableNumber: '1' }),
];

describe('tableAssignmentPanelDomain', () => {
  it('builds the default filter state used by the panel', () => {
    expect(createDefaultTableAssignmentFilters()).toEqual(baseFilters);
  });

  it('builds sorted zone options with a Main fallback', () => {
    expect(getTableAssignmentZoneOptions(tables)).toEqual([
      'all',
      'Booth',
      'Main',
      'Patio',
      'Window',
    ]);
  });

  it('filters unavailable and conflicted tables for the availability-only view', () => {
    const filtered = filterAndSortAssignmentTables({
      conflictedTableIds: new Set(['t-conflict']),
      filters: { ...baseFilters, availabilityOnly: true, sortBy: 'table' },
      partySize: 4,
      tables,
    });

    expect(filtered.map((tableItem) => tableItem.id)).toEqual(['t-booth', 't-main', 't-window']);
  });

  it('filters by capacity fit and groups the resulting inventory', () => {
    const view = buildTableAssignmentInventoryView({
      conflictedTableIds: new Set<string>(),
      filters: { ...baseFilters, fitFilter: 'perfect', zoneFilter: 'Booth' },
      partySize: 4,
      tables,
    });

    expect(view.filteredTables.map((tableItem) => tableItem.id)).toEqual(['t-conflict']);
    expect(Array.from(view.groupedTables.keys())).toEqual(['Booth']);
  });

  it('uses prop times first and falls back to context booking/window times', () => {
    const context = {
      booking: { start_time: '18:30' },
      timezone: 'Europe/London',
      window: { startAt: '17:00', endAt: '23:00' },
    } as AssignmentContext;

    expect(
      parseTableAssignmentTimeline({
        bookingEndTime: '20:15',
        bookingStartTime: null,
        context,
      }),
    ).toMatchObject({
      bookingStart: '18:30',
      bookingEnd: '20:15',
      windowStart: '17:00',
      windowEnd: '23:00',
      parsedBookingStart: 1110,
      parsedBookingEnd: 1215,
      parsedWindowStart: 1020,
      parsedWindowEnd: 1380,
    });
  });
});

function table({
  active = true,
  capacity,
  id,
  section,
  tableNumber,
}: {
  active?: boolean;
  capacity: number;
  id: string;
  section: string | null;
  tableNumber: string;
}): ManualAssignmentTable {
  return {
    active,
    capacity,
    category: 'standard',
    id,
    maxPartySize: capacity + 2,
    minPartySize: 1,
    mobility: 'standard',
    name: tableNumber,
    position: null,
    seatingType: 'standard',
    section,
    status: 'available',
    tableNumber,
    zoneActive: true,
    zoneId: 'zone-1',
  };
}
