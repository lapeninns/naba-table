import { useMemo } from 'react';

import { createLinkEditor, removeEditorRow, updateEditorRow } from './businessContextEditorActions';

import type { LinkEditor } from './businessContextModel';

/** Applies an update to one section of the Discovery draft. */
export type BusinessContextFamilyUpdate<T> = (updater: (current: T) => T) => void;

export function useBusinessContextLinkDraft(update: BusinessContextFamilyUpdate<LinkEditor[]>) {
  return useMemo(
    () => ({
      /** Adds an empty link and returns its row id, so focus can move to it. */
      addLink: () => {
        const row = createLinkEditor();
        update((current) => [...current, row]);
        return row.id;
      },
      updateLink: <Key extends keyof LinkEditor>(
        rowId: string,
        field: Key,
        value: LinkEditor[Key],
      ) => update((current) => updateEditorRow(current, rowId, field, value)),
      removeLink: (rowId: string) => update((current) => removeEditorRow(current, rowId)),
    }),
    [update],
  );
}
