import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildTableDraft } from '@/components/features/tables/tableInventoryFormDomain';
import { useTableEditorState } from '@/components/features/tables/useTableEditorState';

import type { TableInventory } from '@/services/ops/tables';

const ZONES = [{ id: 'zone-main', active: true }];

function makeTable(overrides: Partial<TableInventory> = {}): TableInventory {
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
    zoneId: 'zone-main',
    zoneName: 'Main',
    zoneActive: true,
    active: true,
    status: 'available',
    position: null,
    notes: null,
    ...overrides,
  };
}

function setup(table: TableInventory) {
  return renderHook(() =>
    useTableEditorState({ activeRestaurantId: 'rest-1', tables: [table], zones: ZONES }),
  );
}

describe('useTableEditorState', () => {
  it('keeps a field typed while the table was saving and takes the server values for the rest', () => {
    const table = makeTable();
    const { result } = setup(table);

    act(() => result.current.openTable(table));
    act(() => result.current.updateDraft({ capacity: '6', section: 'Bar ' }));

    // Save is clicked: the validated draft is what the request sends.
    let payload: ReturnType<typeof result.current.validate> = null;
    act(() => {
      payload = result.current.validate();
    });
    expect(payload).toMatchObject({ capacity: 6, section: 'Bar' });

    // Staff keep typing while the request is in flight.
    act(() => result.current.updateDraft({ notes: 'Window seat' }));

    // The server stores the trimmed section.
    const saved = makeTable({ capacity: 6, section: 'Bar' });
    act(() => result.current.markSaved(saved));

    const editor = result.current.editor;
    expect(editor?.table).toBe(saved);
    expect(editor?.initial).toEqual(buildTableDraft(saved, ZONES));
    expect(editor?.draft).toEqual({ ...buildTableDraft(saved, ZONES), notes: 'Window seat' });
    expect(result.current.isDirty).toBe(true);

    // Discarding (close, confirm) and reopening shows the server-confirmed table.
    act(() => result.current.close());
    const pending = result.current.pendingDiscard;
    expect(pending).not.toBeNull();
    act(() => pending?.run());
    expect(result.current.editor).toBeNull();
    act(() => result.current.openTable(saved));
    expect(result.current.editor?.draft).toEqual(buildTableDraft(saved, ZONES));
    expect(result.current.isDirty).toBe(false);
  });

  it('shows the saved table unchanged when nothing was typed during the save', () => {
    const table = makeTable();
    const { result } = setup(table);

    act(() => result.current.openTable(table));
    act(() => result.current.updateDraft({ capacity: '6' }));
    act(() => {
      result.current.validate();
    });

    const saved = makeTable({ capacity: 6 });
    act(() => result.current.markSaved(saved));

    expect(result.current.editor?.draft).toEqual(buildTableDraft(saved, ZONES));
    expect(result.current.isDirty).toBe(false);
  });
});
