import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDualSyncConfirmPublishAction } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncConfirmPublishAction';

import type { DualSyncPendingPublishPreview } from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishRequestDomain';
import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
} from '@/services/ops/dual-sync';

function publishRequest(): DualSyncPublishRequest {
  return {
    clientRequestId: 'client-request-1',
    decisions: [
      {
        fieldKey: 'profile.phone',
        sectionKey: 'profile',
        action: 'export_to_google',
        pinnedCoreHash: 'core-field-hash',
        pinnedGbpHash: 'gbp-field-hash',
      },
    ],
    pinnedCoreSnapshotHash: 'state-core-hash',
    pinnedGbpSnapshotHash: 'state-gbp-hash',
  };
}

function publishPlan(
  overrides: Partial<DualSyncPublishPreviewResponse> = {},
): DualSyncPublishPreviewResponse {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'plan-core-hash',
    gbpSnapshotHash: 'plan-gbp-hash',
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
            pinnedCoreHash: 'core-field-hash',
            pinnedGbpHash: 'gbp-field-hash',
          },
        ],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: false,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [],
    ...overrides,
  };
}

function publishResult(overrides: Partial<DualSyncPublishResponse> = {}): DualSyncPublishResponse {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    totalDecisions: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    operations: [],
    failures: [],
    ...overrides,
  };
}

function pendingPreview(
  plan: DualSyncPublishPreviewResponse = publishPlan(),
): DualSyncPendingPublishPreview {
  return {
    request: publishRequest(),
    plan,
  };
}

function renderConfirmAction({
  clearPublishPreview = vi.fn(),
  openPublishResult = vi.fn(),
  publishMutation = vi.fn(async () => publishResult()),
  publishPreview = pendingPreview(),
  setDecisions = vi.fn(),
  showToast = vi.fn(),
}: {
  readonly clearPublishPreview?: () => void;
  readonly openPublishResult?: (result: DualSyncPublishResponse) => void;
  readonly publishMutation?: (request: DualSyncPublishRequest) => Promise<DualSyncPublishResponse>;
  readonly publishPreview?: DualSyncPendingPublishPreview | null;
  readonly setDecisions?: (decisions: Record<string, never>) => void;
  readonly showToast?: ReturnType<typeof vi.fn>;
} = {}) {
  const workspace = {
    publishMutation: {
      mutateAsync: publishMutation,
    },
    setDecisions,
  } as unknown as DualSyncWorkspace;

  return {
    clearPublishPreview,
    openPublishResult,
    publishMutation,
    setDecisions,
    showToast,
    ...renderHook(() =>
      useDualSyncConfirmPublishAction({
        workspace,
        publishPreview,
        clearPublishPreview,
        openPublishResult,
        showToast,
      }),
    ),
  };
}

describe('useDualSyncConfirmPublishAction', () => {
  it('blocks confirmation without accepted preview decisions', async () => {
    const noPreview = renderConfirmAction({ publishPreview: null });

    await act(async () => noPreview.result.current());

    expect(noPreview.publishMutation).not.toHaveBeenCalled();
    expect(noPreview.showToast).not.toHaveBeenCalled();

    const noAcceptedFields = renderConfirmAction({
      publishPreview: pendingPreview(publishPlan({ groups: [] })),
    });

    await act(async () => noAcceptedFields.result.current());

    expect(noAcceptedFields.publishMutation).not.toHaveBeenCalled();
    expect(noAcceptedFields.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'No accepted decisions to publish.',
    });
  });

  it('publishes accepted preview decisions and opens the result', async () => {
    const clearPublishPreview = vi.fn();
    const openPublishResult = vi.fn();
    const publishMutation = vi.fn(async () => publishResult());
    const setDecisions = vi.fn();
    const showToast = vi.fn();
    const { result } = renderConfirmAction({
      clearPublishPreview,
      openPublishResult,
      publishMutation,
      setDecisions,
      showToast,
    });

    await act(async () => result.current());

    expect(publishMutation).toHaveBeenCalledWith({
      ...publishRequest(),
      pinnedCoreSnapshotHash: 'plan-core-hash',
      pinnedGbpSnapshotHash: 'plan-gbp-hash',
    });
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: '1 fields synced.',
    });
    expect(setDecisions).toHaveBeenCalledWith({});
    expect(clearPublishPreview).toHaveBeenCalled();
    expect(openPublishResult).toHaveBeenCalledWith(publishResult());
  });
});
