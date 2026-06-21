import { describe, expect, it } from 'vitest';

import {
  clearBusinessContextFamilyError,
  clearSavedBusinessContextFamily,
  isBusinessContextDirty,
  markBusinessContextFamilyClean,
  markBusinessContextFamilyDirty,
  resolveBusinessContextSaveErrorMessage,
  setBusinessContextFamilyError,
} from '@/components/features/restaurant-settings/businessContextEditorWorkflow';

import type {
  DirtyState,
  ErrorState,
  FamilyKey,
} from '@/components/features/restaurant-settings/businessContextModel';

const families: FamilyKey[] = [
  'businessDetails',
  'links',
  'categories',
  'serviceAreas',
  'attributes',
  'serviceItems',
];

const emptyDirty = Object.fromEntries(families.map((family) => [family, false])) as DirtyState;

describe('businessContextEditorWorkflow', () => {
  it('detects whether any family is dirty', () => {
    expect(isBusinessContextDirty(emptyDirty)).toBe(false);
    expect(isBusinessContextDirty({ ...emptyDirty, links: true })).toBe(true);
  });

  it('marks individual families dirty or clean without changing other families', () => {
    expect(markBusinessContextFamilyDirty(emptyDirty, 'categories')).toEqual({
      ...emptyDirty,
      categories: true,
    });
    expect(
      markBusinessContextFamilyClean({ ...emptyDirty, categories: true }, 'categories'),
    ).toEqual(emptyDirty);
  });

  it('clears and sets scoped family errors', () => {
    const errors: ErrorState = {
      links: 'Bad link',
      categories: 'Bad category',
    };

    expect(clearBusinessContextFamilyError(errors, 'links')).toEqual({
      links: null,
      categories: 'Bad category',
    });
    expect(setBusinessContextFamilyError(errors, 'serviceAreas', 'Bad place')).toEqual({
      links: 'Bad link',
      categories: 'Bad category',
      serviceAreas: 'Bad place',
    });
  });

  it('clears the saved marker only when the edited family matches', () => {
    expect(clearSavedBusinessContextFamily('links', 'links')).toBeNull();
    expect(clearSavedBusinessContextFamily('links', 'categories')).toBe('links');
    expect(clearSavedBusinessContextFamily(null, 'categories')).toBeNull();
  });

  it('normalizes save errors into operator-facing messages', () => {
    expect(resolveBusinessContextSaveErrorMessage(new Error('Network failed'))).toBe(
      'Network failed',
    );
    expect(resolveBusinessContextSaveErrorMessage('unknown')).toBe('Unable to save changes.');
  });
});
