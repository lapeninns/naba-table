import { describe, expect, it } from 'vitest';

import {
  buildAssignmentTableMap,
  calculateAssignmentSelectedCapacity,
  resolveAssignedTables,
  resolveBookingAssignmentError,
  resolveBookingAssignmentPreflight,
  resolveEffectiveSelectedIds,
} from '@/components/features/dashboard/booking-details/bookingAssignmentDomain';
import { HttpError } from '@/lib/http/errors';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

function makeTable(overrides: Partial<ManualAssignmentTable> & { id: string }) {
  return {
    id: overrides.id,
    tableNumber: overrides.tableNumber ?? overrides.id,
    name: overrides.name ?? null,
    capacity: overrides.capacity ?? 4,
    minPartySize: overrides.minPartySize ?? 1,
    maxPartySize: overrides.maxPartySize ?? 8,
    section: overrides.section ?? null,
    category: overrides.category ?? 'standard',
    seatingType: overrides.seatingType ?? 'standard',
    mobility: overrides.mobility ?? 'standard',
    zoneId: overrides.zoneId ?? 'zone-main',
    zoneActive: overrides.zoneActive ?? true,
    status: overrides.status ?? 'available',
    active: overrides.active ?? true,
    position: overrides.position ?? null,
  } satisfies ManualAssignmentTable;
}

describe('bookingAssignmentDomain', () => {
  it('derives effective selection, assigned tables, and selected capacity', () => {
    const tables = [makeTable({ id: 't-1', capacity: 2 }), makeTable({ id: 't-2', capacity: 6 })];
    const tableMap = buildAssignmentTableMap(tables);

    expect(
      resolveEffectiveSelectedIds({
        assignedTableIds: ['t-2'],
        selectedTableIds: [],
      }),
    ).toEqual(['t-2']);
    expect(
      resolveEffectiveSelectedIds({
        assignedTableIds: ['t-2'],
        selectedTableIds: ['t-1'],
      }),
    ).toEqual(['t-1']);
    expect(
      calculateAssignmentSelectedCapacity({
        selectedTableIds: ['t-1', 'missing', 't-2'],
        tableMap,
      }),
    ).toBe(8);
    expect(resolveAssignedTables({ assignedTableIds: ['t-2', 'missing'], tableMap })).toEqual([
      tables[1],
    ]);
  });

  it('resolves assignment preflight states', () => {
    const tableMap = buildAssignmentTableMap([makeTable({ id: 't-1' })]);

    expect(
      resolveBookingAssignmentPreflight({
        assignedTableCount: 1,
        selectedTableIds: ['t-1'],
        tableMap,
      }).kind,
    ).toBe('already-assigned');
    expect(
      resolveBookingAssignmentPreflight({
        assignedTableCount: 0,
        selectedTableIds: [],
        tableMap,
      }).kind,
    ).toBe('empty-selection');
    expect(
      resolveBookingAssignmentPreflight({
        assignedTableCount: 0,
        selectedTableIds: ['t-1', 'missing'],
        tableMap,
      }),
    ).toMatchObject({
      kind: 'stale-selection',
      validTableIds: ['t-1'],
      staleTableIds: ['missing'],
      message: null,
    });
    expect(
      resolveBookingAssignmentPreflight({
        assignedTableCount: 0,
        selectedTableIds: ['t-1'],
        tableMap,
      }),
    ).toEqual({ kind: 'ready', tableIds: ['t-1'] });
  });

  it('shapes assignment HTTP errors for orchestration state updates', () => {
    expect(
      resolveBookingAssignmentError(
        new HttpError({
          message: 'Tables missing',
          status: 404,
          code: 'TABLES_NOT_FOUND',
          details: { missingTableIds: ['t-9'] },
        }),
        { partySize: 4, selectedCapacity: 0, selectedTableIds: ['t-9'] },
      ),
    ).toEqual({
      kind: 'missing-tables',
      missingTableIds: ['t-9'],
      message: 'Selected tables were removed: t-9',
    });

    const validation = resolveBookingAssignmentError(
      new HttpError({
        message: 'Selection invalid',
        status: 422,
        details: {
          checks: [
            { id: 'capacity', passed: false, message: 'Capacity is too low.' },
            { id: 'sameZone', passed: true, message: 'Same zone.' },
          ],
        },
      }),
      { partySize: 6, selectedCapacity: 4, selectedTableIds: ['t-1'] },
    );

    expect(validation).toMatchObject({
      kind: 'validation',
      message: 'Selection invalid\n\n• Capacity is too low.',
      validationResult: {
        ok: false,
        checks: [{ id: 'capacity', status: 'error', message: 'Capacity is too low.' }],
        summary: {
          tableCount: 1,
          totalCapacity: 4,
          partySize: 6,
          slack: -2,
          zoneId: null,
          tableNumbers: ['t-1'],
        },
      },
    });
  });
});
