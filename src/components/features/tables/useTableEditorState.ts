'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRegisterOptionalOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';

import {
  buildTableDraft,
  getDuplicateTableNumberMessage,
  getFirstInvalidTableField,
  isTableDraftDirty,
  parseTableDraft,
  type TableDraft,
  type TableFormErrors,
} from './tableInventoryFormDomain';

import type { TableFormState, TableZone } from './tableInventoryModel';
import type { TableInventory } from '@/services/ops/tables';

export const TABLE_EDITOR_UNSAVED_ID = 'restaurant-tables-editor';
export const TABLE_EDITOR_FIELD_PREFIX = 'tf-';

export type TableEditor = {
  /** The saved table being edited; null for a new table. */
  table: TableInventory | null;
  initial: TableDraft;
  draft: TableDraft;
  errors: TableFormErrors;
  /** Bumps when the editor starts over, so focus moves to the first field. */
  session: number;
};

type PendingDiscard = { run: () => void; title: string; description: string } | null;

function focusEditorField(field: string) {
  window.setTimeout(() => {
    document.getElementById(`${TABLE_EDITOR_FIELD_PREFIX}${field}`)?.focus();
  }, 0);
}

/**
 * The one table open for editing, in the side panel on wide screens or a sheet on narrow ones.
 * Unsaved edits are guarded: switching tables, closing or leaving the page asks first.
 */
export function useTableEditorState({
  activeRestaurantId,
  tables,
  zones,
}: {
  activeRestaurantId: string | null;
  tables: ReadonlyArray<TableInventory>;
  zones: ReadonlyArray<Pick<TableZone, 'id' | 'active'>>;
}) {
  const [editor, setEditor] = useState<TableEditor | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<PendingDiscard>(null);
  const sessionRef = useRef(0);
  /** The draft the last validated save was built from, and the editor session it belongs to. */
  const sentRef = useRef<{ session: number; draft: TableDraft } | null>(null);

  const isDirty = editor
    ? editor.table === null || isTableDraftDirty(editor.draft, editor.initial)
    : false;

  useRegisterOptionalOpsUnsavedChanges(
    TABLE_EDITOR_UNSAVED_ID,
    isDirty,
    'You have unsaved changes to this table. If you leave now, they’ll be lost.',
  );

  useEffect(() => {
    setEditor(null);
    setPendingDiscard(null);
  }, [activeRestaurantId]);

  const start = useCallback(
    (table: TableInventory | null, zoneId: string | null = null) => {
      sessionRef.current += 1;
      const built = buildTableDraft(table, zones, zoneId);
      // A zone added a moment ago may not be in `zones` yet; keep the one asked for.
      const initial = !table && zoneId && !built.zoneId ? { ...built, zoneId } : built;
      setEditor({ table, initial, draft: initial, errors: {}, session: sessionRef.current });
    },
    [zones],
  );

  /** Runs `action` now, or after the operator agrees to drop unsaved edits. */
  const guard = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      setPendingDiscard({
        run: action,
        title: 'Discard changes to this table?',
        description: editor?.table
          ? 'You have unsaved changes in the details panel.'
          : 'This table hasn’t been added yet.',
      });
    },
    [editor?.table, isDirty],
  );

  const openTable = useCallback(
    (table: TableInventory) => guard(() => start(table)),
    [guard, start],
  );
  const openNewTable = useCallback(
    (zoneId: string | null = null) => guard(() => start(null, zoneId)),
    [guard, start],
  );
  const close = useCallback(() => guard(() => setEditor(null)), [guard]);
  const closeNow = useCallback(() => setEditor(null), []);

  const updateDraft = useCallback((patch: Partial<TableDraft>) => {
    setEditor((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current,
    );
  }, []);

  /** Validates the draft; returns the payload to save, or shows the errors and focuses the first. */
  const validate = useCallback((): TableFormState | null => {
    if (!editor) return null;
    const result = parseTableDraft(editor.draft);
    const errors: TableFormErrors = result.ok ? {} : { ...result.errors };
    const number = editor.draft.tableNumber.trim().toLocaleLowerCase('en-GB');
    if (
      !errors.tableNumber &&
      number &&
      tables.some(
        (other) =>
          other.id !== editor.table?.id &&
          other.tableNumber.trim().toLocaleLowerCase('en-GB') === number,
      )
    ) {
      errors.tableNumber = getDuplicateTableNumberMessage(editor.draft.tableNumber);
    }
    setEditor({ ...editor, errors });
    const first = getFirstInvalidTableField(errors);
    if (first || !result.ok) {
      if (first) focusEditorField(first);
      return null;
    }
    sentRef.current = { session: editor.session, draft: editor.draft };
    return result.payload;
  }, [editor, tables]);

  const showTableNumberError = useCallback((message: string) => {
    setEditor((current) =>
      current ? { ...current, errors: { ...current.errors, tableNumber: message } } : current,
    );
    focusEditorField('tableNumber');
  }, []);

  /**
   * After a save the editor shows the saved table; focus stays where it was. A field changed
   * after the save was sent keeps the newer value and stays unsaved.
   */
  const markSaved = useCallback(
    (table: TableInventory) => {
      const initial = buildTableDraft(table, zones);
      const sent = sentRef.current;
      sentRef.current = null;
      setEditor((current) => {
        const draft = { ...initial };
        if (current && sent && sent.session === current.session) {
          for (const key of Object.keys(draft) as Array<keyof TableDraft>) {
            if (current.draft[key] !== sent.draft[key]) {
              Object.assign(draft, { [key]: current.draft[key] });
            }
          }
        }
        return {
          table,
          initial,
          draft: isTableDraftDirty(draft, initial) ? draft : initial,
          errors: {},
          session: current?.session ?? sessionRef.current,
        };
      });
    },
    [zones],
  );

  return {
    close,
    closeNow,
    editor,
    isDirty,
    markSaved,
    openNewTable,
    openTable,
    pendingDiscard,
    setPendingDiscard,
    showTableNumberError,
    updateDraft,
    validate,
  } as const;
}
