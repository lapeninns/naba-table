import { describe, expect, it } from 'vitest';

import {
  computeSectionReviewProgress,
  computeWorkspaceReviewProgress,
  fieldNeedsOperatorChoice,
} from '@/components/features/restaurant-settings/dual-sync/workspace-progress';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function baseField(over: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
  return {
    fieldKey: 'x',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'L',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'x',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'low',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'string',
      canonicalizer: 'canonicalizeString',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'a',
    gbpValue: 'b',
    coreCanonicalHash: 'c',
    gbpCanonicalHash: 'g',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'core_dirty',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...over,
  };
}

describe('workspace-progress', () => {
  it('flags drift-like states as needing operator choice', () => {
    expect(fieldNeedsOperatorChoice(baseField({ state: 'core_dirty' }))).toBe(true);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'gbp_dirty' }))).toBe(true);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'conflict' }))).toBe(true);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'export_failed' }))).toBe(true);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'in_sync' }))).toBe(false);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'pending_export' }))).toBe(false);
    expect(fieldNeedsOperatorChoice(baseField({ state: 'pending_import' }))).toBe(false);
    expect(fieldNeedsOperatorChoice(baseField({ conflictPolicy: 'unsupported' }))).toBe(false);
  });

  it('computes workspace draft coverage', () => {
    const f1 = baseField({ fieldKey: 'a', state: 'core_dirty' });
    const f2 = baseField({ fieldKey: 'b', state: 'in_sync' });
    const p = computeWorkspaceReviewProgress([f1, f2], {});
    expect(p.needsReviewCount).toBe(1);
    expect(p.draftedForReviewCount).toBe(0);
    expect(p.draftCoveragePercent).toBe(0);

    const p2 = computeWorkspaceReviewProgress([f1, f2], { a: { action: 'ignore' } });
    expect(p2.draftedForReviewCount).toBe(1);
    expect(p2.draftCoveragePercent).toBe(100);
  });

  it('computes per-section progress', () => {
    const fields = [
      baseField({ fieldKey: 'a', state: 'core_dirty' }),
      baseField({ fieldKey: 'b', state: 'gbp_dirty' }),
    ];
    const s = computeSectionReviewProgress(fields, { a: { action: 'import_from_google' } });
    expect(s.needsReviewCount).toBe(2);
    expect(s.draftedForReviewCount).toBe(1);
    expect(s.draftCoveragePercent).toBe(50);
  });
});
