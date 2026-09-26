import { describe, expect, it } from 'vitest';

import {
  buildDualSyncShellViewState,
  pickDualSyncDecisions,
  summarizeDualSyncDecisions,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncShellDomain';

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
        decisions: {
          'profile.name': { action: 'export_to_google' },
          'profile.phone': { action: 'import_from_google' },
          'profile.website': { action: 'ignore' },
        },
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
      decisionSummary: { toSend: 1, toImport: 1, ignored: 1 },
      canPublish: true,
      canImport: true,
    });
  });

  it('only allows publishing Send to Google choices and saving Use Google choices', () => {
    expect(
      buildDualSyncShellViewState({
        stateData: makeState(),
        decisions: { 'profile.name': { action: 'ignore' } },
        publishPending: false,
        previewPublishPending: false,
      }),
    ).toMatchObject({ canPublish: false, canImport: false });
  });

  it('blocks writes and submit while paused or publish mutations are pending', () => {
    const pausedState = makeState({
      control: {
        ...makeState().control,
        syncPaused: true,
        pauseReason: 'Maintenance window.',
      },
    });
    const decisions = {
      'profile.name': { action: 'export_to_google' },
      'profile.phone': { action: 'import_from_google' },
    } as const;

    expect(
      buildDualSyncShellViewState({
        stateData: pausedState,
        decisions,
        publishPending: false,
        previewPublishPending: false,
      }),
    ).toMatchObject({
      syncPaused: true,
      pauseReason: 'Maintenance window.',
      writeBlocked: true,
      canPublish: false,
      canImport: false,
    });

    expect(
      buildDualSyncShellViewState({
        stateData: makeState(),
        decisions,
        publishPending: true,
        previewPublishPending: false,
      }),
    ).toMatchObject({ writeBlocked: true, canPublish: false, canImport: false });
  });

  it('builds safe defaults before state data is available', () => {
    expect(
      buildDualSyncShellViewState({
        stateData: undefined,
        decisions: {},
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
      decisionSummary: { toSend: 0, toImport: 0, ignored: 0 },
      canPublish: false,
      canImport: false,
    });
  });

  it('summarises and splits draft decisions by action', () => {
    const decisions = {
      a: { action: 'export_to_google' },
      b: { action: 'export_to_google' },
      c: { action: 'import_from_google' },
      d: { action: 'ignore' },
    } as const;

    expect(summarizeDualSyncDecisions(decisions)).toEqual({ toSend: 2, toImport: 1, ignored: 1 });
    expect(pickDualSyncDecisions(decisions, 'export_to_google')).toEqual({
      a: { action: 'export_to_google' },
      b: { action: 'export_to_google' },
    });
    expect(pickDualSyncDecisions(decisions, 'import_from_google')).toEqual({
      c: { action: 'import_from_google' },
    });
  });
});
