import { useMemo } from 'react';

import {
  createServiceItemEditor,
  removeEditorRow,
  updateEditorRow,
} from './businessContextEditorActions';

import type { ServiceItemEditor } from './businessContextModel';
import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';

export function useBusinessContextServiceItemDraft(
  update: BusinessContextFamilyUpdate<ServiceItemEditor[]>,
) {
  return useMemo(
    () => ({
      /** Adds an empty service and returns its row id, so focus can move to it. */
      addServiceItem: () => {
        const row = createServiceItemEditor();
        update((current) => [...current, row]);
        return row.id;
      },
      updateServiceItem: <Key extends keyof ServiceItemEditor>(
        rowId: string,
        field: Key,
        value: ServiceItemEditor[Key],
      ) => update((current) => updateEditorRow(current, rowId, field, value)),
      removeServiceItem: (rowId: string) => update((current) => removeEditorRow(current, rowId)),
    }),
    [update],
  );
}
