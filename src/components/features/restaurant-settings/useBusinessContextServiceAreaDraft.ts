import { useMemo } from 'react';

import {
  addNamedServiceAreaEditor,
  createServiceAreaEditor,
  removeEditorRow,
  updateEditorRow,
} from './businessContextEditorActions';

import type { ServiceAreaEditor } from './businessContextModel';
import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';

export function useBusinessContextServiceAreaDraft(
  update: BusinessContextFamilyUpdate<ServiceAreaEditor[]>,
) {
  return useMemo(
    () => ({
      /** Adds an area by name; returns false when the name is blank. */
      addServiceArea: (displayName: string) => {
        const name = displayName.trim();
        if (!name) {
          return false;
        }
        const row = createServiceAreaEditor(name);
        update((current) => addNamedServiceAreaEditor(current, row));
        return true;
      },
      updateServiceArea: <Key extends keyof ServiceAreaEditor>(
        rowId: string,
        field: Key,
        value: ServiceAreaEditor[Key],
      ) => update((current) => updateEditorRow(current, rowId, field, value)),
      removeServiceArea: (rowId: string) => update((current) => removeEditorRow(current, rowId)),
    }),
    [update],
  );
}
