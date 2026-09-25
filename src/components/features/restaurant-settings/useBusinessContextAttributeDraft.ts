import { useMemo } from 'react';

import {
  createAttributeEditor,
  removeEditorRow,
  setAmenityAttributeValue,
  updateEditorRow,
  type AmenityValue,
} from './businessContextEditorActions';

import type { AmenityAttributeDefinition, AttributeEditor } from './businessContextModel';
import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';

export function useBusinessContextAttributeDraft(
  update: BusinessContextFamilyUpdate<AttributeEditor[]>,
) {
  return useMemo(
    () => ({
      setAmenityValue: (
        definition: AmenityAttributeDefinition,
        groupTitle: string,
        value: AmenityValue,
      ) => update((current) => setAmenityAttributeValue(current, definition, groupTitle, value)),
      /** Adds an empty raw attribute row and returns its row id. */
      addAttribute: () => {
        const row = createAttributeEditor();
        update((current) => [...current, row]);
        return row.id;
      },
      updateAttribute: <Key extends keyof AttributeEditor>(
        rowId: string,
        field: Key,
        value: AttributeEditor[Key],
      ) => update((current) => updateEditorRow(current, rowId, field, value)),
      removeAttribute: (rowId: string) => update((current) => removeEditorRow(current, rowId)),
    }),
    [update],
  );
}
