import { useState } from 'react';

import {
  createAttributeEditor,
  removeEditorRow,
  toggleAmenityAttributeEditor,
  updateEditorRow,
} from './businessContextEditorActions';

import type { AmenityAttributeDefinition, AttributeEditor } from './businessContextModel';

type UseBusinessContextAttributeDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextAttributeDraft({
  onDirty,
}: UseBusinessContextAttributeDraftOptions) {
  const [attributes, setAttributes] = useState<AttributeEditor[]>([]);

  const toggleAmenityAttribute = (
    definition: AmenityAttributeDefinition,
    groupTitle: string,
    checked: boolean,
  ) => {
    setAttributes((current) =>
      toggleAmenityAttributeEditor(current, definition, groupTitle, checked),
    );
    onDirty();
  };

  const addAttribute = () => {
    setAttributes((current) => [...current, createAttributeEditor()]);
    onDirty();
  };

  const updateAttribute = <Key extends keyof AttributeEditor>(
    rowId: string,
    field: Key,
    value: AttributeEditor[Key],
  ) => {
    setAttributes((current) => updateEditorRow(current, rowId, field, value));
    onDirty();
  };

  const removeAttribute = (rowId: string) => {
    setAttributes((current) => removeEditorRow(current, rowId));
    onDirty();
  };

  return {
    attributes,
    setAttributes,
    toggleAmenityAttribute,
    addAttribute,
    updateAttribute,
    removeAttribute,
  };
}
