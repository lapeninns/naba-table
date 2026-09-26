import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDualSyncWorkspaceReviewState } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspaceReviewState';

import type { DualSyncSectionKey } from '@/server/dual-sync';
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

interface ReviewStateProps {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly coreSnapshotHash?: string | null;
  readonly gbpSnapshotHash?: string | null;
}

function renderReviewState(initialProps: ReviewStateProps) {
  return renderHook((props: ReviewStateProps) => useDualSyncWorkspaceReviewState(props), {
    initialProps,
  });
}

describe('useDualSyncWorkspaceReviewState', () => {
  it('derives visible sections, grouped fields, and review progress', async () => {
    const fields = [
      makeField({ fieldKey: 'profile.later', sectionKey: 'profile', sortOrder: 2 }),
      makeField({ fieldKey: 'hours.weekly', sectionKey: 'operatingHours', sortOrder: 0 }),
      makeField({ fieldKey: 'profile.first', sectionKey: 'profile', sortOrder: 1 }),
      makeField({ fieldKey: 'core.local', sectionKey: 'core_only' }),
    ];

    const { result } = renderReviewState({
      fields,
      sections: ['profile', 'operatingHours'],
      coreSnapshotHash: 'core-1',
      gbpSnapshotHash: 'gbp-1',
    });

    expect(result.current.visibleFields.map((field) => field.fieldKey)).toEqual([
      'profile.later',
      'hours.weekly',
      'profile.first',
    ]);
    expect(result.current.fieldsBySection.get('profile')?.map((field) => field.fieldKey)).toEqual([
      'profile.first',
      'profile.later',
    ]);
    expect(result.current.orderedSectionKeys).toEqual(['profile', 'operatingHours']);
    expect(result.current.workspaceProgress.totalFields).toBe(3);
  });

  it('updates individual and section decisions through existing domain rules', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({ fieldKey: 'profile.synced', state: 'in_sync' }),
    ];
    const { result } = renderReviewState({
      fields,
      sections: ['profile'],
      coreSnapshotHash: 'core-1',
      gbpSnapshotHash: 'gbp-1',
    });

    act(() => result.current.onSelectAction('profile.name', 'ignore'));

    expect(result.current.decisions).toEqual({ 'profile.name': { action: 'ignore' } });
    expect(result.current.decisionCount).toBe(1);

    act(() => result.current.onBulkSelectSection(fields, 'export_to_google'));

    expect(result.current.decisions).toEqual({
      'profile.name': { action: 'export_to_google' },
    });

    act(() => result.current.onClearSection(fields));

    expect(result.current.decisions).toEqual({});
    expect(result.current.decisionCount).toBe(0);
  });

  it('resets decisions when snapshot hashes change', async () => {
    const fields = [makeField({ fieldKey: 'profile.name', state: 'conflict' })];
    const { result, rerender } = renderReviewState({
      fields,
      sections: ['profile'],
      coreSnapshotHash: 'core-1',
      gbpSnapshotHash: 'gbp-1',
    });

    act(() => result.current.onSelectAction('profile.name', 'ignore'));

    expect(result.current.decisionCount).toBe(1);

    rerender({
      fields,
      sections: ['profile'],
      coreSnapshotHash: 'core-2',
      gbpSnapshotHash: 'gbp-1',
    });

    await waitFor(() => expect(result.current.decisionCount).toBe(0));
  });
});
