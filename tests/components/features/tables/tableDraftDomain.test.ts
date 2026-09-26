import { describe, expect, it } from 'vitest';

import {
  buildTableDraft,
  isTableDraftDirty,
  parseTableDraft,
} from '@/components/features/tables/tableInventoryFormDomain';

import type { TableInventory } from '@/services/ops/tables';

const zones = [
  { id: 'off', active: false },
  { id: 'main', active: true },
];

describe('table editor draft', () => {
  it('starts a new table with four seats in the chosen or first active zone', () => {
    expect(buildTableDraft(null, zones)).toEqual({
      tableNumber: '',
      capacity: '4',
      minPartySize: '1',
      maxPartySize: '',
      zoneId: 'main',
      mobility: 'movable',
      active: true,
      status: 'available',
      seatingType: 'standard',
      category: 'dining',
      section: '',
      notes: '',
    });
    expect(buildTableDraft(null, zones, 'off').zoneId).toBe('off');
  });

  it('starts from a saved table and notices edits', () => {
    const saved = buildTableDraft(table({ maxPartySize: 4, notes: 'Window' }), zones);

    expect(saved).toMatchObject({ tableNumber: '7', capacity: '4', maxPartySize: '4' });
    expect(isTableDraftDirty(saved, saved)).toBe(false);
    expect(isTableDraftDirty({ ...saved, notes: 'Door' }, saved)).toBe(true);
  });

  it('parses a valid draft into the save payload', () => {
    const draft = { ...buildTableDraft(table(), zones), maxPartySize: '', section: '  ' };

    expect(parseTableDraft(draft)).toEqual({
      ok: true,
      payload: {
        tableNumber: '7',
        capacity: 4,
        minPartySize: 1,
        maxPartySize: null,
        section: null,
        notes: null,
        zoneId: 'main',
        category: 'dining',
        seatingType: 'standard',
        mobility: 'movable',
        status: 'available',
        active: true,
      },
    });
  });

  it('keeps a fixed table to its seats', () => {
    const draft = {
      ...buildTableDraft(table(), zones),
      mobility: 'fixed' as const,
      maxPartySize: '6',
    };

    expect(parseTableDraft(draft)).toEqual({
      ok: false,
      errors: { maxPartySize: 'A fixed table can’t take more than its 4 seats' },
    });
  });

  it('reports every invalid field', () => {
    const draft = {
      ...buildTableDraft(null, zones),
      capacity: '0',
      minPartySize: '3',
      maxPartySize: '2',
    };

    expect(parseTableDraft(draft)).toEqual({
      ok: false,
      errors: {
        tableNumber: 'Enter a table number',
        capacity: 'Enter seats from 1 to 20',
        maxPartySize: 'Largest party must be at least the smallest party, up to 20',
      },
    });
  });
});

function table(overrides: Partial<TableInventory> = {}): TableInventory {
  return {
    id: 'table-7',
    restaurantId: 'rest-1',
    tableNumber: '7',
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
