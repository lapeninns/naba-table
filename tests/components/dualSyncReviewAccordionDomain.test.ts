import { describe, expect, it } from 'vitest';

import {
  buildDualSyncReviewSectionFieldRows,
  buildDualSyncReviewSectionModel,
  buildDualSyncReviewSectionState,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewAccordionDomain';

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

describe('dualSyncReviewAccordionDomain', () => {
  it('builds drift-only section state with draft progress labels', () => {
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
      countBadgeLabel: '2 drifted',
      hasSectionReview: true,
      progressLeadLabel: 'Draft progress',
      progressCountLabel: '1/2',
      progressValue: 50,
      progressAriaLabel: 'Draft progress for Profile',
      emptyMessage: 'All fields in this section are in sync.',
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
      countBadgeLabel: '1 total',
      hasSectionReview: false,
      progressLeadLabel: 'No review needed',
      progressCountLabel: '0 pending',
      progressValue: 100,
      progressAriaLabel: 'Operating hours has no fields needing review',
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
    expect(state.countBadgeLabel).toBe('0 drifted');
    expect(state.progressAriaLabel).toBe('Categories has no fields needing review');
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
      countBadgeLabel: '2 drifted',
      progressCountLabel: '1/2',
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
