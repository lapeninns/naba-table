import { describe, expect, it } from 'vitest';

import { suggestAssignmentTables } from '@/components/features/dashboard/booking-details/tableAssignmentSuggestionDomain';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

function table(
  id: string,
  capacity: number,
  overrides: Partial<ManualAssignmentTable> = {},
): ManualAssignmentTable {
  return {
    id,
    tableNumber: id,
    name: `Table ${id}`,
    capacity,
    minPartySize: 1,
    maxPartySize: null,
    section: 'Main',
    category: 'standard',
    seatingType: 'standard',
    mobility: 'standard',
    zoneId: 'zone-1',
    zoneActive: true,
    status: 'available',
    active: true,
    position: null,
    ...overrides,
  };
}

describe('suggestAssignmentTables', () => {
  it('filters unavailable, inactive, conflicted, assigned, and party-size incompatible tables', () => {
    const suggestions = suggestAssignmentTables({
      assignedTableIds: new Set(['assigned']),
      conflictedTableIds: new Set(['conflicted']),
      partySize: 4,
      tables: [
        table('exact', 4),
        table('inactive', 4, { active: false }),
        table('reserved', 4, { status: 'reserved' }),
        table('conflicted', 4),
        table('assigned', 4),
        table('too-small', 2),
        table('too-large-party', 4, { maxPartySize: 3 }),
        table('below-minimum', 4, { minPartySize: 5 }),
      ],
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(['exact']);
  });

  it('prioritizes exact fit, lower overage, and stable table numbers', () => {
    const suggestions = suggestAssignmentTables({
      assignedTableIds: new Set(),
      conflictedTableIds: new Set(),
      partySize: 4,
      tables: [table('30', 8), table('20', 6), table('10', 6), table('05', 4)],
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(['05', '10', '20', '30']);
  });

  it('returns at most eight suggestions', () => {
    const suggestions = suggestAssignmentTables({
      assignedTableIds: new Set(),
      conflictedTableIds: new Set(),
      partySize: 2,
      tables: Array.from({ length: 12 }, (_, index) => table(String(index + 1), 2)),
    });

    expect(suggestions).toHaveLength(8);
  });
});
