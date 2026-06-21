import type { DirtyState, ErrorState, FamilyKey } from './businessContextModel';

export function isBusinessContextDirty(dirty: DirtyState): boolean {
  return Object.values(dirty).some(Boolean);
}

export function markBusinessContextFamilyDirty(dirty: DirtyState, family: FamilyKey): DirtyState {
  return { ...dirty, [family]: true };
}

export function markBusinessContextFamilyClean(dirty: DirtyState, family: FamilyKey): DirtyState {
  return { ...dirty, [family]: false };
}

export function clearBusinessContextFamilyError(errors: ErrorState, family: FamilyKey): ErrorState {
  return { ...errors, [family]: null };
}

export function setBusinessContextFamilyError(
  errors: ErrorState,
  family: FamilyKey,
  message: string,
): ErrorState {
  return { ...errors, [family]: message };
}

export function clearSavedBusinessContextFamily(
  savedFamily: FamilyKey | null,
  family: FamilyKey,
): FamilyKey | null {
  return savedFamily === family ? null : savedFamily;
}

export function resolveBusinessContextSaveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save changes.';
}
