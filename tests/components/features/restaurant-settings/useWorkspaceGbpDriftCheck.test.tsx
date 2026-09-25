import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FieldView = {
  sectionKey: string;
  savedNeedsReview: boolean;
  liveStatus: string;
  field: DualSyncFieldSummary;
};

const driftContextState = vi.hoisted(() => ({
  value: null as null | { fieldViews: FieldView[]; isLoading: boolean },
}));

vi.mock('@/components/features/restaurant-settings/gbp-drift/useGbpDrift', () => ({
  useOptionalGbpDrift: () => driftContextState.value,
  useGbpDrift: () => driftContextState.value,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: { data: undefined, isLoading: false, isError: false, error: null },
  }),
}));

import { useWorkspaceGbpDriftCheck } from '@/components/features/restaurant-settings/gbpDriftBadges';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeView(fieldKey: string, sectionKey: string): FieldView {
  return {
    sectionKey,
    savedNeedsReview: false,
    liveStatus: 'drifted',
    field: { fieldKey, sectionKey, label: fieldKey } as DualSyncFieldSummary,
  };
}

const SECTION_KEYS = [
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
] as const;

describe('useWorkspaceGbpDriftCheck', () => {
  beforeEach(() => {
    driftContextState.value = {
      isLoading: false,
      fieldViews: [
        makeView('businessContext.categories.bar', 'businessContext.categories'),
        makeView('businessContext.categories.pub', 'businessContext.categories'),
      ],
    };
  });

  it('@contract returns the same object across renders when inputs are unchanged', () => {
    const { result, rerender } = renderHook(() =>
      useWorkspaceGbpDriftCheck({ restaurantId: 'r-1', sectionKeys: SECTION_KEYS }),
    );
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
    expect(result.current.getField).toBe(first.getField);
    expect(result.current.getFieldsByPrefix).toBe(first.getFieldsByPrefix);
    expect(result.current.getFieldsBySection).toBe(first.getFieldsBySection);
  });

  it('@contract returns stable per-section arrays and one shared empty array for sections without drift', () => {
    const { result, rerender } = renderHook(() =>
      useWorkspaceGbpDriftCheck({ restaurantId: 'r-1', sectionKeys: SECTION_KEYS }),
    );
    const categories = result.current.getFieldsBySection('businessContext.categories');
    const serviceAreas = result.current.getFieldsBySection('businessContext.serviceAreas');

    expect(categories.map((field) => field.fieldKey)).toEqual([
      'businessContext.categories.bar',
      'businessContext.categories.pub',
    ]);
    expect(serviceAreas).toEqual([]);
    expect(result.current.getFieldsBySection('businessContext.categories')).toBe(categories);
    expect(result.current.getFieldsBySection('businessContext.attributes')).toBe(serviceAreas);

    rerender();

    expect(result.current.getFieldsBySection('businessContext.categories')).toBe(categories);
    expect(result.current.getFieldsBySection('businessContext.serviceItems')).toBe(serviceAreas);
  });

  it('@contract returns a new object when the drift fields change', () => {
    const { result, rerender } = renderHook(() =>
      useWorkspaceGbpDriftCheck({ restaurantId: 'r-1', sectionKeys: SECTION_KEYS }),
    );
    const first = result.current;

    driftContextState.value = {
      isLoading: false,
      fieldViews: [makeView('businessContext.attributes.wifi', 'businessContext.attributes')],
    };
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current.getField('businessContext.attributes.wifi')?.fieldKey).toBe(
      'businessContext.attributes.wifi',
    );
    expect(result.current.getFieldsBySection('businessContext.categories')).toEqual([]);
  });
});
