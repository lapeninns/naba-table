import { useMemo } from 'react';

import {
  addMoreHoursTypesToCategory,
  addNamedCategoryEditor,
  createCategoryEditor,
  makePrimaryCategoryEditor,
  removeCategoryEditor,
  removeMoreHoursTypeFromCategory,
  updateCategoryMoreHoursDraft,
  updateEditorRow,
} from './businessContextEditorActions';

import type { CategoryEditor } from './businessContextModel';
import type { BusinessContextFamilyUpdate } from './useBusinessContextLinkDraft';

export function useBusinessContextCategoryDraft(
  update: BusinessContextFamilyUpdate<CategoryEditor[]>,
) {
  return useMemo(
    () => ({
      /** Adds a category by name; returns false when the name is blank. */
      addCategory: (displayName: string) => {
        const name = displayName.trim();
        if (!name) {
          return false;
        }
        const row = { ...createCategoryEditor(), displayName: name };
        update((current) => addNamedCategoryEditor(current, row));
        return true;
      },
      updateCategory: <Key extends keyof CategoryEditor>(
        rowId: string,
        field: Key,
        value: CategoryEditor[Key],
      ) => update((current) => updateEditorRow(current, rowId, field, value)),
      makeCategoryPrimary: (rowId: string) =>
        update((current) => makePrimaryCategoryEditor(current, rowId)),
      removeCategory: (rowId: string) => update((current) => removeCategoryEditor(current, rowId)),
      updateMoreHoursDraft: (rowId: string, value: string) =>
        update((current) => updateCategoryMoreHoursDraft(current, rowId, value)),
      addMoreHoursTypes: (rowId: string, value: string) =>
        update((current) => addMoreHoursTypesToCategory(current, rowId, value)),
      removeMoreHoursType: (rowId: string, typeIndex: number) =>
        update((current) => removeMoreHoursTypeFromCategory(current, rowId, typeIndex)),
    }),
    [update],
  );
}
