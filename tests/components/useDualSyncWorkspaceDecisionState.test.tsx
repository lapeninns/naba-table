import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDualSyncWorkspaceDecisionState } from '@/components/features/restaurant-settings/dual-sync/hooks/useDualSyncWorkspaceDecisionState';

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

describe('useDualSyncWorkspaceDecisionState', () => {
  it('updates individual and section decisions through decision domain rules', () => {
    const fields = [
      makeField({ fieldKey: 'profile.name', state: 'conflict' }),
      makeField({ fieldKey: 'profile.synced', state: 'in_sync' }),
    ];
    const { result } = renderHook(() =>
      useDualSyncWorkspaceDecisionState({
        coreSnapshotHash: 'core-1',
        gbpSnapshotHash: 'gbp-1',
      }),
    );

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
    const { result, rerender } = renderHook(
      ({
        coreSnapshotHash,
        gbpSnapshotHash,
      }: {
        readonly coreSnapshotHash?: string | null;
        readonly gbpSnapshotHash?: string | null;
      }) =>
        useDualSyncWorkspaceDecisionState({
          coreSnapshotHash,
          gbpSnapshotHash,
        }),
      {
        initialProps: {
          coreSnapshotHash: 'core-1',
          gbpSnapshotHash: 'gbp-1',
        },
      },
    );

    act(() => result.current.onSelectAction('profile.name', 'ignore'));

    expect(result.current.decisionCount).toBe(1);

    rerender({
      coreSnapshotHash: 'core-2',
      gbpSnapshotHash: 'gbp-1',
    });

    await waitFor(() => expect(result.current.decisionCount).toBe(0));
  });
});
