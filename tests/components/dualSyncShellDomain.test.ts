import { describe, expect, it } from 'vitest';

import { buildDualSyncShellViewState } from '@/components/features/restaurant-settings/dual-sync/dualSyncShellDomain';

import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';

function makeField(overrides: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Business name',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.name',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'critical',
      importable: true,
      exportable: true,
      requiresManualReview: true,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: true,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable name',
    gbpValue: 'Google name',
    coreCanonicalHash: 'core-hash',
    gbpCanonicalHash: 'gbp-hash',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'conflict',
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
    coreSnapshotHash: 'core-snapshot-hash',
    gbpSnapshotHash: 'gbp-snapshot-hash',
    fields: [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({ fieldKey: 'profile.website', state: 'in_sync' }),
    ],
    outboundQueue: {
      totalOpen: 3,
      autoExportable: 2,
      missingBaseline: 1,
      lastQueuedAt: null,
    },
    lastSnapshot: {
      runId: 'snapshot-run-1',
      runKind: 'manual',
      startedAt: '2026-05-09T10:00:00.000Z',
      finishedAt: '2026-05-09T10:00:01.000Z',
    },
    control: {
      restaurantId: 'restaurant-1',
      provider: 'google_business_profile',
      syncPaused: false,
      pauseReason: null,
      pausedByUserId: null,
      pausedAt: null,
      resumedAt: null,
      createdAt: null,
      updatedAt: null,
    },
    ...overrides,
  };
}

describe('dualSyncShellDomain', () => {
  it('builds active shell display state from workspace data and mutation flags', () => {
    expect(
      buildDualSyncShellViewState({
        stateData: makeState(),
        decisionCount: 1,
        publishPending: false,
        previewPublishPending: false,
      }),
    ).toMatchObject({
      syncPaused: false,
      pauseReason: 'Dual-sync is paused for this restaurant.',
      autoExportable: 2,
      totalOpen: 3,
      lastSnapshotAt: '2026-05-09T10:00:01.000Z',
      writeBlocked: false,
      canSubmit: true,
      overallHeatmap: {
        total: 2,
        conflict: 1,
        in_sync: 1,
        hasActionableState: true,
      },
    });
  });

  it('blocks writes and submit while paused or publish mutations are pending', () => {
    const pausedState = makeState({
      control: {
        ...makeState().control,
        syncPaused: true,
        pauseReason: 'Maintenance window.',
      },
    });

    expect(
      buildDualSyncShellViewState({
        stateData: pausedState,
        decisionCount: 2,
        publishPending: false,
        previewPublishPending: false,
      }),
    ).toMatchObject({
      syncPaused: true,
      pauseReason: 'Maintenance window.',
      writeBlocked: true,
      canSubmit: false,
    });

    expect(
      buildDualSyncShellViewState({
        stateData: makeState(),
        decisionCount: 2,
        publishPending: true,
        previewPublishPending: false,
      }),
    ).toMatchObject({ writeBlocked: true, canSubmit: false });
  });

  it('builds safe defaults before state data is available', () => {
    expect(
      buildDualSyncShellViewState({
        stateData: undefined,
        decisionCount: 0,
        publishPending: false,
        previewPublishPending: false,
      }),
    ).toMatchObject({
      syncPaused: false,
      pauseReason: 'Dual-sync is paused for this restaurant.',
      autoExportable: 0,
      totalOpen: 0,
      lastSnapshotAt: null,
      writeBlocked: false,
      canSubmit: false,
      overallHeatmap: {
        total: 0,
        hasActionableState: false,
      },
    });
  });
});
