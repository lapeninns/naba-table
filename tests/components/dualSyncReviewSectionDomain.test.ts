import { describe, expect, it } from 'vitest';

import {
  buildDualSyncReviewSectionFieldRows,
  buildDualSyncReviewSectionModel,
  buildDualSyncReviewSectionState,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewSectionDomain';

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

describe('dualSyncReviewSectionDomain', () => {
  it('builds drift-only section state with difference and choice counts', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({ fieldKey: 'profile.website', state: 'in_sync' }),
      makeField({ fieldKey: 'profile.phone', state: 'drifted' }),
    ];

    const state = buildDualSyncReviewSectionState({
      sectionKey: 'profile',
      fields,
      showDriftOnly: true,
      sectionProgress: {
        needsReviewCount: 2,
        draftedForReviewCount: 1,
        draftCoveragePercent: 50,
      },
    });

    expect(state).toMatchObject({
      sectionLabel: 'Profile',
      countLabel: '2 differences',
      progressLabel: '1 of 2 chosen',
      emptyMessage: 'Nabatable and Google match for this section.',
    });
    expect(state.displayedFields.map((field) => field.fieldKey)).toEqual([
      'profile.name',
      'profile.phone',
    ]);
  });

  it('builds no-review section state for all fields view', () => {
    const fields = [
      makeField({ fieldKey: 'hours.weekly', sectionKey: 'operatingHours', state: 'in_sync' }),
    ];

    expect(
      buildDualSyncReviewSectionState({
        sectionKey: 'operatingHours',
        fields,
        showDriftOnly: false,
        sectionProgress: {
          needsReviewCount: 0,
          draftedForReviewCount: 0,
          draftCoveragePercent: 100,
        },
      }),
    ).toMatchObject({
      sectionLabel: 'Operating hours',
      displayedFields: fields,
      countLabel: '1 field · 0 different',
      progressLabel: null,
    });
  });

  it('builds an empty drift-only state when all section fields are in sync', () => {
    const state = buildDualSyncReviewSectionState({
      sectionKey: 'businessContext.categories',
      fields: [
        makeField({
          fieldKey: 'categories.primary',
          sectionKey: 'businessContext.categories',
          state: 'in_sync',
        }),
      ],
      showDriftOnly: true,
      sectionProgress: {
        needsReviewCount: 0,
        draftedForReviewCount: 0,
        draftCoveragePercent: 100,
      },
    });

    expect(state.displayedFields).toEqual([]);
    expect(state.countLabel).toBe('0 differences');
    expect(state.progressLabel).toBeNull();
  });

  it('builds displayed field row models with selected actions', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({ fieldKey: 'profile.website', state: 'drifted' }),
    ];

    expect(
      buildDualSyncReviewSectionFieldRows(fields, {
        'profile.name': {
          action: 'export_to_google',
        },
      }),
    ).toEqual([
      {
        field: fields[0],
        selectedAction: 'export_to_google',
      },
      {
        field: fields[1],
        selectedAction: null,
      },
    ]);
  });

  it('builds a full review section model with all-field bulk summary and displayed rows', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({
        fieldKey: 'profile.website',
        state: 'in_sync',
        capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
      }),
      makeField({
        fieldKey: 'profile.phone',
        state: 'drifted',
        capability: { canImport: true, canExport: false, canIgnore: true, blockedReasons: [] },
      }),
    ];

    const model = buildDualSyncReviewSectionModel({
      sectionKey: 'profile',
      fields,
      decisions: {
        'profile.name': { action: 'export_to_google' },
        'profile.website': { action: 'ignore' },
      },
      showDriftOnly: true,
      sectionProgress: {
        needsReviewCount: 2,
        draftedForReviewCount: 1,
        draftCoveragePercent: 50,
      },
    });

    expect(model.sectionState).toMatchObject({
      sectionLabel: 'Profile',
      countLabel: '2 differences',
      progressLabel: '1 of 2 chosen',
    });
    expect(model.fieldRows.map((row) => [row.field.fieldKey, row.selectedAction])).toEqual([
      ['profile.name', 'export_to_google'],
      ['profile.phone', null],
    ]);
    expect(model.bulkSummary).toEqual({
      importable: 2,
      exportable: 1,
      ignorable: 2,
      selected: 2,
    });
  });
});
