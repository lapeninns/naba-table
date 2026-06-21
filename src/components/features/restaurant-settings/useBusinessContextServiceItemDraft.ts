import { useState } from 'react';

import {
  createServiceItemEditor,
  removeEditorRow,
  updateEditorRow,
} from './businessContextEditorActions';

import type { ServiceItemEditor } from './businessContextModel';

type UseBusinessContextServiceItemDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextServiceItemDraft({
  onDirty,
}: UseBusinessContextServiceItemDraftOptions) {
  const [serviceItems, setServiceItems] = useState<ServiceItemEditor[]>([]);

  const addServiceItem = () => {
    setServiceItems((current) => [...current, createServiceItemEditor()]);
    onDirty();
  };

  const updateServiceItem = <Key extends keyof ServiceItemEditor>(
    rowId: string,
    field: Key,
    value: ServiceItemEditor[Key],
  ) => {
    setServiceItems((current) => updateEditorRow(current, rowId, field, value));
    onDirty();
  };

  const removeServiceItem = (rowId: string) => {
    setServiceItems((current) => removeEditorRow(current, rowId));
    onDirty();
  };

  return {
    serviceItems,
    setServiceItems,
    addServiceItem,
    updateServiceItem,
    removeServiceItem,
  };
}
