import { describe, expect, it } from 'vitest';

import { buildDualSyncWorkspaceReviewModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncWorkspaceReviewModelDomain';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

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

describe('buildDualSyncWorkspaceReviewModel', () => {
  it('filters visible fields, groups them by section, and orders the sections', () => {
    const model = buildDualSyncWorkspaceReviewModel({
      fields: [
        makeField({ fieldKey: 'profile.later', sectionKey: 'profile', sortOrder: 2 }),
        makeField({ fieldKey: 'hours.weekly', sectionKey: 'operatingHours', sortOrder: 0 }),
        makeField({ fieldKey: 'profile.first', sectionKey: 'profile', sortOrder: 1 }),
        makeField({ fieldKey: 'core.local', sectionKey: 'core_only' }),
      ],
      sections: ['profile', 'operatingHours'],
      decisions: {},
    });

    expect(model.visibleFields.map((field) => field.fieldKey)).toEqual([
      'profile.later',
      'hours.weekly',
      'profile.first',
    ]);
    expect(model.fieldsBySection.get('profile')?.map((field) => field.fieldKey)).toEqual([
      'profile.first',
      'profile.later',
    ]);
    expect(model.orderedSectionKeys).toEqual(['profile', 'operatingHours']);
  });

  it('computes workspace progress from visible fields and draft decisions', () => {
    const model = buildDualSyncWorkspaceReviewModel({
      fields: [
        makeField({ fieldKey: 'profile.name', state: 'conflict' }),
        makeField({ fieldKey: 'profile.synced', state: 'in_sync' }),
        makeField({ fieldKey: 'profile.drifted', state: 'drifted' }),
        makeField({
          fieldKey: 'profile.unsupported',
          state: 'conflict',
          conflictPolicy: 'unsupported',
        }),
      ],
      sections: ['profile'],
      decisions: { 'profile.name': { action: 'ignore' } },
    });

    expect(model.workspaceProgress).toMatchObject({
      totalFields: 4,
      inSyncCount: 1,
      needsReviewCount: 2,
      draftedForReviewCount: 1,
      syncHealthPercent: 25,
      draftCoveragePercent: 50,
    });
  });
});
