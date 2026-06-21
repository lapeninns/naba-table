import { useCallback, useState } from 'react';

import {
  clearBusinessContextFamilyError,
  clearSavedBusinessContextFamily,
  isBusinessContextDirty,
  markBusinessContextFamilyClean,
  markBusinessContextFamilyDirty,
  setBusinessContextFamilyError,
} from './businessContextEditorWorkflow';
import {
  EMPTY_DIRTY_STATE,
  type DirtyState,
  type ErrorState,
  type FamilyKey,
} from './businessContextModel';

export function useBusinessContextEditorWorkflowState() {
  const [dirty, setDirty] = useState<DirtyState>(EMPTY_DIRTY_STATE);
  const [errors, setErrors] = useState<ErrorState>({});
  const [savedFamily, setSavedFamily] = useState<FamilyKey | null>(null);

  const resetWorkflowState = useCallback(() => {
    setDirty(EMPTY_DIRTY_STATE);
    setErrors({});
    setSavedFamily(null);
  }, []);

  const markDirty = useCallback((family: FamilyKey) => {
    setDirty((current) => markBusinessContextFamilyDirty(current, family));
    setErrors((current) => clearBusinessContextFamilyError(current, family));
    setSavedFamily((current) => clearSavedBusinessContextFamily(current, family));
  }, []);

  const markFamilyClean = useCallback((family: FamilyKey) => {
    setDirty((current) => markBusinessContextFamilyClean(current, family));
    setErrors((current) => clearBusinessContextFamilyError(current, family));
  }, []);

  const prepareFamilySave = useCallback((family: FamilyKey) => {
    setErrors((current) => clearBusinessContextFamilyError(current, family));
  }, []);

  const markFamilySaved = useCallback((family: FamilyKey) => {
    setDirty((current) => markBusinessContextFamilyClean(current, family));
    setSavedFamily(family);
  }, []);

  const markFamilySaveFailed = useCallback((family: FamilyKey, message: string) => {
    setErrors((current) => setBusinessContextFamilyError(current, family, message));
  }, []);

  return {
    dirty,
    errors,
    savedFamily,
    isDirty: isBusinessContextDirty(dirty),
    resetWorkflowState,
    markDirty,
    markFamilyClean,
    prepareFamilySave,
    markFamilySaved,
    markFamilySaveFailed,
  };
}
