import { describe, expect, it, vi } from 'vitest';

import {
  buildConfirmedDualSyncPublishRequest,
  buildDualSyncPublishRequest,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishPayloadDomain';
import {
  buildDualSyncConfirmPublishReadiness,
  buildDualSyncPublishPreviewReadiness,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncPublishRequestDomain';

import type {
  DualSyncPublishPreviewResponse,
  DualSyncPublishRequest,
} from '@/services/ops/dual-sync';
import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';

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

describe('dualSyncPublishRequestDomain', () => {
  it('builds publish preview requests with field pins and snapshot pins', () => {
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');

    expect(
      buildDualSyncPublishRequest(makeState(), {
        'profile.phone': { action: 'export_to_google' },
      }),
    ).toEqual(publishRequest());

    randomUUID.mockRestore();
  });

  it('filters missing and non dual-sync section decisions from publish requests', () => {
    expect(
      buildDualSyncPublishRequest(
        makeState({
          fields: [
            makeField(),
            makeField({
              fieldKey: 'unknown.custom',
              sectionKey: 'unknown',
            }),
          ],
        }),
        {
          'profile.phone': { action: 'import_from_google' },
          'missing.field': { action: 'export_to_google' },
          'unknown.custom': { action: 'ignore' },
        },
      ),
    ).toMatchObject({
      decisions: [
        {
          fieldKey: 'profile.phone',
          sectionKey: 'profile',
          action: 'import_from_google',
          pinnedCoreHash: 'core-field-hash',
          pinnedGbpHash: 'gbp-field-hash',
        },
      ],
    });

    expect(buildDualSyncPublishRequest(undefined, {})).toBeNull();
    expect(buildDualSyncPublishRequest(makeState(), {})).toBeNull();
  });

  it('preserves accepted decisions and preview snapshot pins for confirmed publish', () => {
    expect(
      buildConfirmedDualSyncPublishRequest({
        request: publishRequest(),
        plan: publishPlan(),
      }),
    ).toMatchObject({
      clientRequestId: 'client-request-1',
      pinnedCoreSnapshotHash: 'plan-core-hash',
      pinnedGbpSnapshotHash: 'plan-gbp-hash',
      decisions: [
        {
          fieldKey: 'profile.phone',
          sectionKey: 'profile',
          action: 'export_to_google',
          pinnedCoreHash: 'core-field-hash',
          pinnedGbpHash: 'gbp-field-hash',
        },
      ],
    });

    expect(
      buildConfirmedDualSyncPublishRequest({
        request: publishRequest(),
        plan: publishPlan({ groups: [] }),
      }),
    ).toBeNull();
  });

  it('describes preview readiness blocks and ready requests', () => {
    expect(
      buildDualSyncPublishPreviewReadiness({
        stateData: makeState(),
        decisions: { 'profile.phone': { action: 'export_to_google' } },
        syncPaused: true,
        pauseReason: 'Paused for QA.',
        canSubmit: true,
      }),
    ).toEqual({
      kind: 'blocked',
      message: 'Paused for QA.',
    });

    expect(
      buildDualSyncPublishPreviewReadiness({
        stateData: makeState(),
        decisions: { 'profile.phone': { action: 'export_to_google' } },
        syncPaused: false,
        pauseReason: 'Paused for QA.',
        canSubmit: false,
      }),
    ).toEqual({
      kind: 'blocked',
      message: null,
    });

    expect(
      buildDualSyncPublishPreviewReadiness({
        stateData: undefined,
        decisions: { 'profile.phone': { action: 'export_to_google' } },
        syncPaused: false,
        pauseReason: 'Paused for QA.',
        canSubmit: true,
      }),
    ).toEqual({
      kind: 'blocked',
      message: 'Dual-sync state has not loaded yet.',
    });

    expect(
      buildDualSyncPublishPreviewReadiness({
        stateData: makeState(),
        decisions: {},
        syncPaused: false,
        pauseReason: 'Paused for QA.',
        canSubmit: true,
      }),
    ).toEqual({
      kind: 'blocked',
      message: 'No valid decisions to publish.',
    });

    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue('client-request-1');
    expect(
      buildDualSyncPublishPreviewReadiness({
        stateData: makeState(),
        decisions: { 'profile.phone': { action: 'export_to_google' } },
        syncPaused: false,
        pauseReason: 'Paused for QA.',
        canSubmit: true,
      }),
    ).toEqual({
      kind: 'ready',
      request: publishRequest(),
    });
    randomUUID.mockRestore();
  });

  it('describes confirm readiness from pending preview state', () => {
    expect(buildDualSyncConfirmPublishReadiness(null)).toEqual({
      kind: 'blocked',
      message: null,
    });

    expect(
      buildDualSyncConfirmPublishReadiness({
        request: publishRequest(),
        plan: publishPlan({ groups: [] }),
      }),
    ).toEqual({
      kind: 'blocked',
      message: 'No accepted decisions to publish.',
    });

    expect(
      buildDualSyncConfirmPublishReadiness({
        request: publishRequest(),
        plan: publishPlan(),
      }),
    ).toMatchObject({
      kind: 'ready',
      request: {
        pinnedCoreSnapshotHash: 'plan-core-hash',
        pinnedGbpSnapshotHash: 'plan-gbp-hash',
        decisions: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
          },
        ],
      },
    });
  });
});
