import { describe, expect, it } from 'vitest';

import {
  buildDualSyncFieldRowModel,
  getDualSyncFieldActionAvailability,
  getDualSyncFieldFreshnessDescriptor,
  getDualSyncFieldPolicyLabels,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncFieldRowDomain';

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

describe('dualSyncFieldRowDomain', () => {
  it('builds policy labels from authority, manual review, and risk level', () => {
    expect(getDualSyncFieldPolicyLabels(makeField())).toEqual(['Manual review', 'High-risk field']);

    expect(
      getDualSyncFieldPolicyLabels(
        makeField({
          policy: {
            ...makeField().policy,
            authority: 'google_authoritative',
            riskLevel: 'low',
            requiresManualReview: false,
          },
        }),
      ),
    ).toEqual(['Google-owned']);
  });

  it('blocks import and export actions for unsupported fields', () => {
    expect(
      getDualSyncFieldActionAvailability(
        makeField({
          conflictPolicy: 'unsupported',
          capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
        }),
      ),
    ).toEqual({ isUnsupported: true, canImport: false, canExport: false });
  });

  it('selects freshness copy and timestamps from the field state', () => {
    expect(
      getDualSyncFieldFreshnessDescriptor(
        makeField({
          state: 'in_sync',
          lastInSyncAt: '2026-05-21T10:00:00.000Z',
        }),
      ),
    ).toEqual({
      timestamp: '2026-05-21T10:00:00.000Z',
      prefix: 'In sync',
      neverLabel: 'Never verified',
    });

    expect(
      getDualSyncFieldFreshnessDescriptor(
        makeField({
          state: 'conflict',
          lastCoreChangeAt: '2026-05-21T11:00:00.000Z',
          lastGbpChangeAt: '2026-05-21T09:00:00.000Z',
          lastInSyncAt: '2026-05-20T10:00:00.000Z',
        }),
      ),
    ).toEqual({
      timestamp: '2026-05-21T11:00:00.000Z',
      prefix: 'In conflict',
      neverLabel: 'No history',
    });
  });

  it('builds a field row model for the row shell', () => {
    expect(
      buildDualSyncFieldRowModel(
        makeField({
          helpText: 'Shown to the operator.',
          openCandidate: {
            id: 'candidate-1',
            status: 'open',
            source: 'core_write',
            proposedValueHash: 'hash-new',
            baselineGbpHash: 'hash-old',
            updatedAt: '2026-05-21T11:00:00.000Z',
          },
          capability: {
            canImport: true,
            canExport: false,
            canIgnore: true,
            blockedReasons: ['Export blocked.'],
          },
        }),
      ),
    ).toMatchObject({
      blockedReasons: ['Export blocked.'],
      hasOpenCandidate: true,
      helpText: 'Shown to the operator.',
      label: 'Business name',
      policyLabels: ['Manual review', 'High-risk field'],
      state: 'conflict',
      actionAvailability: { isUnsupported: false, canImport: true, canExport: false },
    });
  });
});
