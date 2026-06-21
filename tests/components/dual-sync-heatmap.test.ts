import { describe, expect, it } from 'vitest';

import { buildDualSyncHeatmapRenderModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncHeatmapRenderDomain';
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

describe('buildDualSyncHeatmapRenderModel', () => {
  it('builds an empty model for zero fields', () => {
    const model = buildDualSyncHeatmapRenderModel({
      total: 0,
      in_sync: 0,
      drift: 0,
      conflict: 0,
      pending: 0,
      failed: 0,
      inactive: 0,
      hasActionableState: false,
    });

    expect(model).toMatchObject({
      isEmpty: true,
      emptyLabel: 'No fields',
      segments: [],
      legendItems: [],
      inactiveOnlyLabel: null,
    });
    expect(model.ariaLabel).toBe(
      'Field state breakdown: In sync 0, Drifted 0, Conflict 0, Pending 0, Failed 0, Inactive 0',
    );
  });

  it('builds segment percentages, titles, and visible legend entries', () => {
    const model = buildDualSyncHeatmapRenderModel({
      total: 10,
      in_sync: 4,
      drift: 2,
      conflict: 1,
      pending: 1,
      failed: 1,
      inactive: 1,
      hasActionableState: true,
    });

    expect(model.isEmpty).toBe(false);
    expect(model.segments).toEqual([
      expect.objectContaining({
        bucket: 'in_sync',
        label: 'In sync',
        title: 'In sync: 4',
        widthPercent: 40,
      }),
      expect.objectContaining({
        bucket: 'drift',
        label: 'Drifted',
        title: 'Drifted: 2',
        widthPercent: 20,
      }),
      expect.objectContaining({
        bucket: 'conflict',
        label: 'Conflict',
        title: 'Conflict: 1',
        widthPercent: 10,
      }),
      expect.objectContaining({
        bucket: 'pending',
        label: 'Pending',
        title: 'Pending: 1',
        widthPercent: 10,
      }),
      expect.objectContaining({
        bucket: 'failed',
        label: 'Failed',
        title: 'Failed: 1',
        widthPercent: 10,
      }),
      expect.objectContaining({
        bucket: 'inactive',
        label: 'Inactive',
        title: 'Inactive: 1',
        widthPercent: 10,
      }),
    ]);
    expect(model.legendItems).toEqual([
      expect.objectContaining({ bucket: 'in_sync', value: 4, shortLabel: 'sync' }),
      expect.objectContaining({ bucket: 'drift', value: 2, shortLabel: 'drift' }),
      expect.objectContaining({ bucket: 'conflict', value: 1, shortLabel: 'cnflct' }),
      expect.objectContaining({ bucket: 'pending', value: 1, shortLabel: 'pndg' }),
      expect.objectContaining({ bucket: 'failed', value: 1, shortLabel: 'fail' }),
    ]);
    expect(model.inactiveOnlyLabel).toBeNull();
  });

  it('builds an inactive-only label when all fields are inactive', () => {
    const model = buildDualSyncHeatmapRenderModel({
      total: 2,
      in_sync: 0,
      drift: 0,
      conflict: 0,
      pending: 0,
      failed: 0,
      inactive: 2,
      hasActionableState: false,
    });

    expect(model.segments).toHaveLength(1);
    expect(model.legendItems).toEqual([]);
    expect(model.inactiveOnlyLabel).toBe('all inactive');
  });
});
