import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDualSyncPublishPreviewDialogState } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncPublishPreviewDialogState';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

function makePlan(overrides: Partial<DualSyncPublishPlan> = {}): DualSyncPublishPlan {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'core-hash',
    gbpSnapshotHash: 'gbp-hash',
    acceptedCount: 1,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-phone',
            pinnedGbpHash: 'gbp-phone',
          },
        ],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: true,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [],
    ...overrides,
  };
}

describe('useDualSyncPublishPreviewDialogState', () => {
  it('requires acknowledgement before confirming risky publish plans', async () => {
    const plan = makePlan();
    const { result } = renderHook(() =>
      useDualSyncPublishPreviewDialogState({
        open: true,
        plan,
        isPublishing: false,
      }),
    );

    expect(result.current.needsAcknowledgement).toBe(true);
    expect(result.current.confirmDisabled).toBe(true);
    expect(result.current.publishButtonLabel).toBe('Publish 1 field');

    await waitFor(() => expect(result.current.acknowledged).toBe(false));

    act(() => result.current.setAcknowledged(true));

    expect(result.current.confirmDisabled).toBe(false);
  });

  it('allows safe plans without acknowledgement and formats plural labels', () => {
    const { result } = renderHook(() =>
      useDualSyncPublishPreviewDialogState({
        open: true,
        plan: makePlan({
          acceptedCount: 2,
          groups: [
            {
              ...makePlan().groups[0]!,
              riskLevel: 'low',
              requiresManualConfirmation: false,
              destructiveWritePossible: false,
            },
          ],
        }),
        isPublishing: false,
      }),
    );

    expect(result.current.needsAcknowledgement).toBe(false);
    expect(result.current.confirmDisabled).toBe(false);
    expect(result.current.publishButtonLabel).toBe('Publish 2 fields');
  });

  it('disables confirm and uses publishing label while publish is pending', () => {
    const { result } = renderHook(() =>
      useDualSyncPublishPreviewDialogState({
        open: true,
        plan: makePlan(),
        isPublishing: true,
      }),
    );

    expect(result.current.confirmDisabled).toBe(true);
    expect(result.current.publishButtonLabel).toBe('Publishing');
  });

  it('resets acknowledgement when the dialog opens with a new plan', async () => {
    const firstPlan = makePlan({ coreSnapshotHash: 'core-1' });
    const secondPlan = makePlan({ coreSnapshotHash: 'core-2' });
    const { result, rerender } = renderHook(
      ({ open, plan }: { readonly open: boolean; readonly plan: DualSyncPublishPlan | null }) =>
        useDualSyncPublishPreviewDialogState({
          open,
          plan,
          isPublishing: false,
        }),
      {
        initialProps: {
          open: true,
          plan: firstPlan,
        },
      },
    );

    act(() => result.current.setAcknowledged(true));

    expect(result.current.acknowledged).toBe(true);

    rerender({
      open: true,
      plan: secondPlan,
    });

    await waitFor(() => expect(result.current.acknowledged).toBe(false));
  });
});
