import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDualSyncPublishActions } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncPublishActions';

import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';
import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  DualSyncPublishResponse,
  GetDualSyncStateResponse,
} from '@/services/ops/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeField(overrides: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'profile.phone',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Phone number',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.phone',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'critical',
      importable: true,
      exportable: true,
      requiresManualReview: true,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'phone',
      canonicalizer: 'canonicalizePhone',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: '+44 1223 000000',
    gbpValue: '+44 1223 111111',
    coreCanonicalHash: 'core-field-hash',
    gbpCanonicalHash: 'gbp-field-hash',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'core_dirty',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<GetDualSyncStateResponse> = {}): GetDualSyncStateResponse {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshot: {},
    gbpSnapshot: {},
    coreSnapshotHash: 'state-core-hash',
    gbpSnapshotHash: 'state-gbp-hash',
    fields: [makeField()],
    outboundQueue: {
      totalOpen: 0,
      autoExportable: 0,
      missingBaseline: 0,
      lastQueuedAt: null,
    },
    lastSnapshot: null,
    control: null,
    ...overrides,
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

function renderPublishActions({
  canSubmit = true,
  decisions = { 'profile.phone': { action: 'export_to_google' } },
  pauseReason = 'Dual-sync is paused.',
  previewPublishMutation = vi.fn(async () => publishPlan()),
  publishMutation = vi.fn(async () => publishResult()),
  setDecisions = vi.fn(),
  showToast = vi.fn(),
  stateData = makeState(),
  syncPaused = false,
}: {
  readonly canSubmit?: boolean;
  readonly decisions?: Record<string, { readonly action: 'export_to_google' }>;
  readonly pauseReason?: string;
  readonly previewPublishMutation?: (
    request: DualSyncPublishRequest,
  ) => Promise<DualSyncPublishPreviewResponse>;
  readonly publishMutation?: (request: DualSyncPublishRequest) => Promise<DualSyncPublishResponse>;
  readonly setDecisions?: (decisions: Record<string, never>) => void;
  readonly showToast?: ReturnType<typeof vi.fn>;
  readonly stateData?: GetDualSyncStateResponse | null | undefined;
  readonly syncPaused?: boolean;
} = {}) {
  const workspace = {
    decisions,
    previewPublishMutation: {
      mutateAsync: previewPublishMutation,
    },
    publishMutation: {
      mutateAsync: publishMutation,
    },
    setDecisions,
    stateQuery: {
      data: stateData,
    },
  } as unknown as DualSyncWorkspace;

  return {
    previewPublishMutation,
    publishMutation,
    setDecisions,
    showToast,
    ...renderHook(() =>
      useDualSyncPublishActions({
        workspace,
        syncPaused,
        pauseReason,
        canSubmit,
        showToast,
      }),
    ),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useDualSyncPublishActions', () => {
  it('blocks preview while paused, disabled, unloaded, or empty', async () => {
    const paused = renderPublishActions({ pauseReason: 'Paused for QA.', syncPaused: true });
    await act(async () => paused.result.current.onClickPublish());
    expect(paused.previewPublishMutation).not.toHaveBeenCalled();
    expect(paused.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Paused for QA.',
    });

    const disabled = renderPublishActions({ canSubmit: false });
    await act(async () => disabled.result.current.onClickPublish());
    expect(disabled.previewPublishMutation).not.toHaveBeenCalled();
    expect(disabled.showToast).not.toHaveBeenCalled();

    const unloaded = renderPublishActions({ stateData: null });
    await act(async () => unloaded.result.current.onClickPublish());
    expect(unloaded.previewPublishMutation).not.toHaveBeenCalled();
    expect(unloaded.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Dual-sync state has not loaded yet.',
    });

    const empty = renderPublishActions({ decisions: {} });
    await act(async () => empty.result.current.onClickPublish());
    expect(empty.previewPublishMutation).not.toHaveBeenCalled();
    expect(empty.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'No valid decisions to publish.',
    });
  });

  it('opens publish preview and warns when no selected fields are eligible', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');
    const previewPublishMutation = vi.fn(async () =>
      publishPlan({
        acceptedCount: 0,
        groups: [],
      }),
    );
    const { result, showToast } = renderPublishActions({ previewPublishMutation });

    await act(async () => result.current.onClickPublish());

    expect(previewPublishMutation).toHaveBeenCalledWith({
      clientRequestId: 'client-request-1',
      decisions: [
        {
          action: 'export_to_google',
          fieldKey: 'profile.phone',
          pinnedCoreHash: 'core-field-hash',
          pinnedGbpHash: 'gbp-field-hash',
          sectionKey: 'profile',
        },
      ],
      pinnedCoreSnapshotHash: 'state-core-hash',
      pinnedGbpSnapshotHash: 'state-gbp-hash',
    });
    expect(result.current.publishPreviewOpen).toBe(true);
    expect(result.current.publishPreviewPlan?.acceptedCount).toBe(0);
    expect(showToast).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'No selected fields are eligible to publish.',
    });
  });

  it('confirms an accepted preview and opens the publish result', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');
    const publishMutation = vi.fn(async () => publishResult());
    const { result, setDecisions, showToast } = renderPublishActions({ publishMutation });

    await act(async () => result.current.onClickPublish());
    await act(async () => result.current.onConfirmPublishPreview());

    expect(publishMutation).toHaveBeenCalledWith({
      clientRequestId: 'client-request-1',
      decisions: [
        {
          action: 'export_to_google',
          fieldKey: 'profile.phone',
          pinnedCoreHash: 'core-field-hash',
          pinnedGbpHash: 'gbp-field-hash',
          sectionKey: 'profile',
        },
      ],
      pinnedCoreSnapshotHash: 'plan-core-hash',
      pinnedGbpSnapshotHash: 'plan-gbp-hash',
    });
    expect(showToast).toHaveBeenCalledWith({
      kind: 'success',
      message: '1 fields synced.',
    });
    expect(setDecisions).toHaveBeenCalledWith({});
    expect(result.current.publishResultOpen).toBe(true);
    expect(result.current.publishResult?.publishJobId).toBe('publish-job-1');
  });

  it('reports preview and confirm mutation failures', async () => {
    const previewFailure = renderPublishActions({
      previewPublishMutation: vi.fn(async () => {
        throw new Error('Preview broke');
      }),
    });
    await act(async () => previewFailure.result.current.onClickPublish());
    expect(previewFailure.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Preview broke',
    });

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');
    const confirmFailure = renderPublishActions({
      publishMutation: vi.fn(async () => {
        throw new Error('Publish broke');
      }),
    });
    await act(async () => confirmFailure.result.current.onClickPublish());
    await act(async () => confirmFailure.result.current.onConfirmPublishPreview());
    expect(confirmFailure.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Publish broke',
    });
  });
});
