import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import {
  formatPhoneForTel,
  getCapacityFit,
  getMinutesUntilTime,
  validateTableSelection,
} from '@/components/features/dashboard/booking-details/utils';

import type { ManualAssignmentTable } from '@/services/ops/bookings';

const baseTable: ManualAssignmentTable = {
  id: 't-1',
  tableNumber: '10',
  capacity: 4,
  minPartySize: 1,
  maxPartySize: 4,
  section: 'Main',
  category: 'dining',
  seatingType: 'indoor',
  mobility: 'standard',
  zoneId: 'zone-1',
  zoneActive: true,
  status: 'available',
  active: true,
  position: null,
};

describe('booking-details utils', () => {
  it('formats phone numbers for tel links', () => {
    expect(formatPhoneForTel('+1 (415) 555-0199')).toBe('+14155550199');
  });

  it('calculates minutes until time with timezone awareness', () => {
    const now = DateTime.fromISO('2025-12-28T12:00:00', { zone: 'UTC' });
    const diff = getMinutesUntilTime('12:30', '2025-12-28', 'UTC', now);
    expect(diff).toBe(30);
  });

  it('derives capacity fit correctly', () => {
    expect(getCapacityFit(4, { ...baseTable, capacity: 4, maxPartySize: 4 })).toBe('exact');
    expect(getCapacityFit(4, { ...baseTable, capacity: 6, maxPartySize: 6 })).toBe('within');
    expect(getCapacityFit(4, { ...baseTable, capacity: 10, maxPartySize: 10 })).toBe('oversized');
    expect(getCapacityFit(4, { ...baseTable, minPartySize: 6, maxPartySize: 8 })).toBe('too_small');
  });

  it('validates table selection warnings and errors', () => {
    const tableA = { ...baseTable, id: 'a', tableNumber: 'A', capacity: 2 };
    const tableB = { ...baseTable, id: 'b', tableNumber: 'B', capacity: 3 };

    const validation = validateTableSelection({
      partySize: 5,
      selectedTables: [tableA, tableB],
      conflictedTableIds: new Set(['b']),
      hasExistingAssignments: false,
    });

    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.warnings.length).toBeGreaterThan(0);
  });
});
