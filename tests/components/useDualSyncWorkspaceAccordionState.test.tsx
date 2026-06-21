import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDualSyncWorkspaceAccordionState } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspaceAccordionState';

describe('useDualSyncWorkspaceAccordionState', () => {
  it('initializes to the first available value in single-open mode', async () => {
    const { result } = renderHook(() =>
      useDualSyncWorkspaceAccordionState({
        orderedAccordionValues: ['profile', 'operatingHours'],
        singleOpenSections: true,
      }),
    );

    await waitFor(() => expect(result.current.openSection).toBe('profile'));
  });

  it('keeps a valid value and falls back when the current value disappears', async () => {
    const { result, rerender } = renderHook(
      ({
        orderedAccordionValues,
        singleOpenSections,
      }: {
        readonly orderedAccordionValues: ReadonlyArray<string>;
        readonly singleOpenSections: boolean;
      }) =>
        useDualSyncWorkspaceAccordionState({
          orderedAccordionValues,
          singleOpenSections,
        }),
      {
        initialProps: {
          orderedAccordionValues: ['profile', 'operatingHours'],
          singleOpenSections: true,
        },
      },
    );

    await waitFor(() => expect(result.current.openSection).toBe('profile'));

    act(() => result.current.setOpenSection('operatingHours'));

    rerender({
      orderedAccordionValues: ['profile'],
      singleOpenSections: true,
    });

    await waitFor(() => expect(result.current.openSection).toBe('profile'));
  });

  it('does not force an open value in multiple-open mode', () => {
    const { result } = renderHook(() =>
      useDualSyncWorkspaceAccordionState({
        orderedAccordionValues: ['profile', 'operatingHours'],
        singleOpenSections: false,
      }),
    );

    expect(result.current.openSection).toBeUndefined();
  });
});
