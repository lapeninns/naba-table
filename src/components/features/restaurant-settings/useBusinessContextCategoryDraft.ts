import { useState } from 'react';

import {
  addMoreHoursTypesToCategory,
  createCategoryEditor,
  hasMoreHoursTypeDraftValues,
  removeEditorRow,
  removeMoreHoursTypeFromCategory,
  updateCategoryMoreHoursDraft,
  updateEditorRow,
} from './businessContextEditorActions';

import type { CategoryEditor } from './businessContextModel';

type UseBusinessContextCategoryDraftOptions = {
  onDirty: () => void;
};

export function useBusinessContextCategoryDraft({
  onDirty,
}: UseBusinessContextCategoryDraftOptions) {
  const [categories, setCategories] = useState<CategoryEditor[]>([]);

  const addCategory = () => {
    setCategories((current) => [...current, createCategoryEditor()]);
    onDirty();
  };

  const updateCategory = <Key extends keyof CategoryEditor>(
    rowId: string,
    field: Key,
    value: CategoryEditor[Key],
  ) => {
    setCategories((current) => updateEditorRow(current, rowId, field, value));
    onDirty();
  };

  const removeCategory = (rowId: string) => {
    setCategories((current) => removeEditorRow(current, rowId));
    onDirty();
  };

  const updateMoreHoursDraft = (rowId: string, value: string) => {
    setCategories((current) => updateCategoryMoreHoursDraft(current, rowId, value));
  };

  const addMoreHoursTypes = (rowId: string, value: string) => {
    setCategories((current) => addMoreHoursTypesToCategory(current, rowId, value));
    if (hasMoreHoursTypeDraftValues(value)) {
      onDirty();
    }
  };

  const removeMoreHoursType = (rowId: string, typeIndex: number) => {
    setCategories((current) => removeMoreHoursTypeFromCategory(current, rowId, typeIndex));
    onDirty();
  };

  return {
    categories,
    setCategories,
    addCategory,
    updateCategory,
    removeCategory,
    updateMoreHoursDraft,
    addMoreHoursTypes,
    removeMoreHoursType,
  };
}
