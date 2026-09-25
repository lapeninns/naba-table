import { describe, expect, it } from 'vitest';

import {
  clearDualSyncSectionDecisions,
  getDualSyncSectionBulkSummary,
  setDualSyncFieldDecision,
  setDualSyncSectionDecisions,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncWorkspaceDecisionDomain';
import {
  getOrderedDualSyncSectionKeys,
  getVisibleDualSyncFields,
  groupDualSyncFieldsBySection,
  isDualSyncSectionKey,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncWorkspaceDomain';

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

describe('dualSyncWorkspaceDomain', () => {
  it('recognizes shipped dual-sync section keys only', () => {
    expect(isDualSyncSectionKey('profile')).toBe(true);
    expect(isDualSyncSectionKey('core_only')).toBe(false);
  });

  it('filters visible fields by optional section scope', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', sectionKey: 'profile' }),
      makeField({ fieldKey: 'hours.weekly', sectionKey: 'operatingHours' }),
      makeField({ fieldKey: 'core.local', sectionKey: 'core_only' }),
    ];

    expect(getVisibleDualSyncFields(fields).map((field) => field.fieldKey)).toEqual([
      'profile.name',
      'hours.weekly',
    ]);
    expect(
      getVisibleDualSyncFields(fields, ['operatingHours']).map((field) => field.fieldKey),
    ).toEqual(['hours.weekly']);
  });

  it('groups fields by section and keeps each section sorted by sort order', () => {
    const grouped = groupDualSyncFieldsBySection([
      makeField({ fieldKey: 'profile.later', sectionKey: 'profile', sortOrder: 2 }),
      makeField({ fieldKey: 'profile.first', sectionKey: 'profile', sortOrder: 1 }),
      makeField({ fieldKey: 'hours.weekly', sectionKey: 'operatingHours', sortOrder: 0 }),
    ]);

    expect(grouped.get('profile')?.map((field) => field.fieldKey)).toEqual([
      'profile.first',
      'profile.later',
    ]);
    expect(getOrderedDualSyncSectionKeys(grouped)).toEqual(['profile', 'operatingHours']);
  });

  it('summarizes actionable section capabilities and selected decisions', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({
        fieldKey: 'profile.url',
        state: 'drifted',
        capability: { canImport: true, canExport: false, canIgnore: true, blockedReasons: [] },
      }),
      makeField({ fieldKey: 'profile.synced', state: 'in_sync' }),
      makeField({
        fieldKey: 'profile.unsupported',
        state: 'conflict',
        conflictPolicy: 'unsupported',
      }),
    ];

    expect(getDualSyncSectionBulkSummary(fields, { 'profile.name': { action: 'ignore' } })).toEqual(
      {
        importable: 2,
        exportable: 1,
        ignorable: 2,
        selected: 1,
      },
    );
  });

  it('updates individual and section-level decisions without mutating previous maps', () => {
    const initial = { existing: { action: 'ignore' as const } };
    const withField = setDualSyncFieldDecision(initial, 'profile.name', 'export_to_google');
    const clearedField = setDualSyncFieldDecision(withField, 'existing', null);
    const sectionSelected = setDualSyncSectionDecisions(
      clearedField,
      [
        makeField({ fieldKey: 'profile.name', state: 'conflict' }),
        makeField({ fieldKey: 'profile.synced', state: 'in_sync' }),
      ],
      'import_from_google',
    );
    const sectionCleared = clearDualSyncSectionDecisions(sectionSelected, [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
    ]);

    expect(initial).toEqual({ existing: { action: 'ignore' } });
    expect(withField).toMatchObject({
      existing: { action: 'ignore' },
      'profile.name': { action: 'export_to_google' },
    });
    expect(clearedField).toEqual({ 'profile.name': { action: 'export_to_google' } });
    expect(sectionSelected).toEqual({ 'profile.name': { action: 'import_from_google' } });
    expect(sectionCleared).toEqual({});
  });
});
