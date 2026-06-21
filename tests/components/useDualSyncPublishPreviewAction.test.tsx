import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDualSyncPublishPreviewAction } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncPublishPreviewAction';

import type { DualSyncWorkspace } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspace';
import type {
  DualSyncFieldSummary,
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
  GetDualSyncStateResponse,
} from '@/services/ops/dual-sync';

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
    acceptedCount: 0,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [],
    rejected: [],
    warnings: [],
    ...overrides,
  };
}

function renderPreviewAction({
  canSubmit = true,
  decisions = { 'profile.phone': { action: 'export_to_google' } },
  openPublishPreview = vi.fn(),
  pauseReason = 'Dual-sync is paused.',
  previewPublishMutation = vi.fn(async () => publishPlan()),
  showToast = vi.fn(),
  stateData = makeState(),
  syncPaused = false,
}: {
  readonly canSubmit?: boolean;
  readonly decisions?: Record<string, { readonly action: 'export_to_google' }>;
  readonly openPublishPreview?: (
    request: DualSyncPublishRequest,
    plan: DualSyncPublishPreviewResponse,
  ) => void;
  readonly pauseReason?: string;
  readonly previewPublishMutation?: (
    request: DualSyncPublishRequest,
  ) => Promise<DualSyncPublishPreviewResponse>;
  readonly showToast?: ReturnType<typeof vi.fn>;
  readonly stateData?: GetDualSyncStateResponse | null | undefined;
  readonly syncPaused?: boolean;
} = {}) {
  const workspace = {
    decisions,
    previewPublishMutation: {
      mutateAsync: previewPublishMutation,
    },
    stateQuery: {
      data: stateData,
    },
  } as unknown as DualSyncWorkspace;

  return {
    openPublishPreview,
    previewPublishMutation,
    showToast,
    ...renderHook(() =>
      useDualSyncPublishPreviewAction({
        workspace,
        syncPaused,
        pauseReason,
        canSubmit,
        openPublishPreview,
        showToast,
      }),
    ),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useDualSyncPublishPreviewAction', () => {
  it('blocks preview when readiness fails', async () => {
    const paused = renderPreviewAction({ pauseReason: 'Paused for QA.', syncPaused: true });

    await act(async () => paused.result.current());

    expect(paused.previewPublishMutation).not.toHaveBeenCalled();
    expect(paused.openPublishPreview).not.toHaveBeenCalled();
    expect(paused.showToast).toHaveBeenCalledWith({
      kind: 'error',
      message: 'Paused for QA.',
    });
  });

  it('previews decisions and warns when the plan accepts no fields', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');
    const openPublishPreview = vi.fn();
    const previewPublishMutation = vi.fn(async () => publishPlan());
    const { result, showToast } = renderPreviewAction({
      openPublishPreview,
      previewPublishMutation,
    });

    await act(async () => result.current());

    const expectedRequest = {
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
    };
    expect(previewPublishMutation).toHaveBeenCalledWith(expectedRequest);
    expect(openPublishPreview).toHaveBeenCalledWith(expectedRequest, publishPlan());
    expect(showToast).toHaveBeenCalledWith({
      kind: 'warning',
      message: 'No selected fields are eligible to publish.',
    });
  });
});
