import { useCallback, useState } from 'react';

import {
  createServiceAreaEditor,
  removeEditorRow,
  updateEditorRow,
} from './businessContextEditorActions';

import type { ServiceAreaEditor } from './businessContextModel';

type UseBusinessContextServiceAreaDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextServiceAreaDraft({
  onDirty,
}: UseBusinessContextServiceAreaDraftOptions) {
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaEditor[]>([]);
  const [serviceAreaDraft, setServiceAreaDraft] = useState('');

  const updateServiceArea = <Key extends keyof ServiceAreaEditor>(
    rowId: string,
    field: Key,
    value: ServiceAreaEditor[Key],
  ) => {
    setServiceAreas((current) => updateEditorRow(current, rowId, field, value));
    onDirty();
  };

  const addServiceAreaFromDraft = () => {
    const displayName = serviceAreaDraft.trim();
    if (!displayName) {
      return;
    }

    setServiceAreas((current) => [...current, createServiceAreaEditor(displayName)]);
    setServiceAreaDraft('');
    onDirty();
  };

  const removeServiceArea = (rowId: string) => {
    setServiceAreas((current) => removeEditorRow(current, rowId));
    onDirty();
  };

  const resetServiceAreas = useCallback((nextServiceAreas: ServiceAreaEditor[]) => {
    setServiceAreas(nextServiceAreas);
    setServiceAreaDraft('');
  }, []);

  return {
    serviceAreas,
    serviceAreaDraft,
    setServiceAreas,
    setServiceAreaDraft,
    resetServiceAreas,
    updateServiceArea,
    addServiceAreaFromDraft,
    removeServiceArea,
  };
}
