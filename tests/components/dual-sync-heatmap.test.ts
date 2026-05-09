import { describe, expect, it } from 'vitest';

import {
  bucketForFieldState,
  summarizeFieldsToHeatmap,
} from '@/components/features/restaurant-settings/dual-sync/heatmap';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function makeField(over: Partial<DualSyncFieldSummary> = {}): DualSyncFieldSummary {
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
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Acme',
    gbpValue: 'Acme',
    coreCanonicalHash: null,
    gbpCanonicalHash: null,
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'in_sync',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...over,
  };
}

describe('bucketForFieldState', () => {
  it('maps known states into the right bucket', () => {
    expect(bucketForFieldState('in_sync')).toBe('in_sync');
    expect(bucketForFieldState('core_dirty')).toBe('drift');
    expect(bucketForFieldState('gbp_dirty')).toBe('drift');
    expect(bucketForFieldState('drifted')).toBe('drift');
    expect(bucketForFieldState('conflict')).toBe('conflict');
    expect(bucketForFieldState('pending_import')).toBe('pending');
    expect(bucketForFieldState('pending_export')).toBe('pending');
    expect(bucketForFieldState('import_failed')).toBe('failed');
    expect(bucketForFieldState('export_failed')).toBe('failed');
    expect(bucketForFieldState('ignored')).toBe('inactive');
    expect(bucketForFieldState('unsupported')).toBe('inactive');
  });

  it('maps unknown / null states to inactive', () => {
    expect(bucketForFieldState(null)).toBe('inactive');
    expect(bucketForFieldState(undefined)).toBe('inactive');
    expect(bucketForFieldState('weird-state')).toBe('inactive');
  });
});

describe('summarizeFieldsToHeatmap', () => {
  it('returns zero counts for an empty list', () => {
    const out = summarizeFieldsToHeatmap([]);
    expect(out).toEqual({
      total: 0,
      in_sync: 0,
      drift: 0,
      conflict: 0,
      pending: 0,
      failed: 0,
      inactive: 0,
      hasActionableState: false,
    });
  });

  it('aggregates counts across all bucket states', () => {
    const out = summarizeFieldsToHeatmap([
      makeField({ fieldKey: 'a', state: 'in_sync' }),
      makeField({ fieldKey: 'b', state: 'in_sync' }),
      makeField({ fieldKey: 'c', state: 'core_dirty' }),
      makeField({ fieldKey: 'd', state: 'drifted' }),
      makeField({ fieldKey: 'e', state: 'conflict' }),
      makeField({ fieldKey: 'f', state: 'pending_export' }),
      makeField({ fieldKey: 'g', state: 'export_failed' }),
      makeField({ fieldKey: 'h', state: 'ignored' }),
      makeField({ fieldKey: 'i', state: 'unsupported' }),
    ]);
    expect(out.total).toBe(9);
    expect(out.in_sync).toBe(2);
    expect(out.drift).toBe(2);
    expect(out.conflict).toBe(1);
    expect(out.pending).toBe(1);
    expect(out.failed).toBe(1);
    expect(out.inactive).toBe(2);
    expect(out.hasActionableState).toBe(true);
  });

  it('returns hasActionableState=false when only in_sync + inactive present', () => {
    const out = summarizeFieldsToHeatmap([
      makeField({ fieldKey: 'a', state: 'in_sync' }),
      makeField({ fieldKey: 'b', state: 'ignored' }),
      makeField({ fieldKey: 'c', state: 'unsupported' }),
    ]);
    expect(out.hasActionableState).toBe(false);
  });

  it('treats null / unknown field states as inactive', () => {
    const out = summarizeFieldsToHeatmap([
      makeField({ fieldKey: 'a', state: null }),
      makeField({ fieldKey: 'b', state: 'unknown' as unknown as DualSyncFieldSummary['state'] }),
    ]);
    expect(out.inactive).toBe(2);
    expect(out.hasActionableState).toBe(false);
  });
});
