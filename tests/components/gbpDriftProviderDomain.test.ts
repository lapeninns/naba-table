import { describe, expect, it, vi } from 'vitest';

import {
  buildGbpDriftPublishRequest,
  deriveGbpDriftFieldViews,
  draftValuesEqual,
  filterImportableGbpDriftViews,
  getGbpDriftCountBySection,
  getGbpDriftFieldViewByKey,
  getTotalGbpDriftCount,
} from '@/components/features/restaurant-settings/gbp-drift/gbpDriftProviderDomain';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

describe('gbpDriftProviderDomain', () => {
  it('derives sorted comparable field views and excludes core-only fields', () => {
    const views = deriveGbpDriftFieldViews({
      draftOverrides: {},
      fields: [
        driftField({
          fieldKey: 'core.bookingPolicy',
          sectionKey: 'core_only',
        }),
        driftField({
          fieldKey: 'operatingHours.weekly.1',
          sectionKey: 'operatingHours',
          sortOrder: 2,
        }),
        driftField({
          fieldKey: 'profile.name',
          sectionKey: 'profile',
          sortOrder: 10,
        }),
      ],
    });

    expect(views.map((view) => view.fieldKey)).toEqual(['profile.name', 'operatingHours.weekly.1']);
    expect(views[0]).toMatchObject({
      canImport: true,
      effectiveStatus: 'drifted',
      hasDraftOverride: false,
      liveStatus: 'drifted',
      sectionKey: 'profile',
    });
  });

  it('uses draft overrides to recalculate live and effective drift', () => {
    const views = deriveGbpDriftFieldViews({
      draftOverrides: {
        'profile.name': 'Google value',
      },
      fields: [
        driftField({
          coreValue: 'Nabatable value',
          fieldKey: 'profile.name',
          gbpValue: 'Google value',
          sectionKey: 'profile',
        }),
      ],
    });

    expect(views[0]).toMatchObject({
      effectiveStatus: 'synced',
      hasDraftOverride: true,
      liveMatches: true,
      liveStatus: 'synced',
      localValue: 'Google value',
    });
  });

  it('summarizes drift counts by section and total', () => {
    const views = deriveGbpDriftFieldViews({
      draftOverrides: {
        'profile.name': 'Google value',
      },
      fields: [
        driftField({
          coreValue: 'Nabatable value',
          fieldKey: 'profile.name',
          gbpValue: 'Google value',
          sectionKey: 'profile',
        }),
        driftField({
          fieldKey: 'operatingHours.weekly.1',
          sectionKey: 'operatingHours',
        }),
      ],
    });

    const counts = getGbpDriftCountBySection(views);

    expect(counts.profile).toBe(0);
    expect(counts.operatingHours).toBe(1);
    expect(getTotalGbpDriftCount(counts)).toBe(1);
  });

  it('indexes views and filters importable drift by section and field options', () => {
    const views = deriveGbpDriftFieldViews({
      draftOverrides: {},
      fields: [
        driftField({
          fieldKey: 'profile.name',
          sectionKey: 'profile',
        }),
        driftField({
          capability: { canExport: true, canIgnore: true, canImport: false, blockedReasons: [] },
          fieldKey: 'operatingHours.weekly.1',
          sectionKey: 'operatingHours',
        }),
      ],
    });

    expect(getGbpDriftFieldViewByKey(views).get('profile.name')?.fieldKey).toBe('profile.name');
    expect(filterImportableGbpDriftViews(views).map((view) => view.fieldKey)).toEqual([
      'profile.name',
    ]);
    expect(
      filterImportableGbpDriftViews(views, { sectionKey: 'operatingHours' }).map(
        (view) => view.fieldKey,
      ),
    ).toEqual([]);
    expect(
      filterImportableGbpDriftViews(views, { fieldKey: 'profile.name' }).map(
        (view) => view.fieldKey,
      ),
    ).toEqual(['profile.name']);
  });

  it('builds the import_from_google publish request with pinned hashes', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_234);
    const [view] = deriveGbpDriftFieldViews({
      draftOverrides: {},
      fields: [
        driftField({
          coreCanonicalHash: 'core-hash',
          fieldKey: 'profile.name',
          gbpCanonicalHash: 'gbp-hash',
          sectionKey: 'profile',
        }),
      ],
    });

    expect(buildGbpDriftPublishRequest([view])).toEqual({
      clientRequestId: 'gbp-drift-1234',
      decisions: [
        {
          action: 'import_from_google',
          fieldKey: 'profile.name',
          pinnedCoreHash: 'core-hash',
          pinnedGbpHash: 'gbp-hash',
          sectionKey: 'profile',
        },
      ],
    });

    now.mockRestore();
  });

  it('compares draft values structurally when possible', () => {
    expect(draftValuesEqual({ a: 1, b: [2] }, { a: 1, b: [2] })).toBe(true);
    expect(draftValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

function driftField(overrides: Partial<DualSyncFieldSummary>): DualSyncFieldSummary {
  const fieldKey = overrides.fieldKey ?? 'profile.name';
  const sectionKey = overrides.sectionKey ?? 'profile';
  return {
    fieldKey,
    sectionKey,
    kind: 'profile',
    label: fieldKey,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey,
      sectionKey: sectionKey as DualSyncSectionKey,
      authority: 'bidirectional_manual',
      riskLevel: 'medium',
      importable: true,
      exportable: true,
      requiresManualReview: false,
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: false,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable value',
    gbpValue: 'Google value',
    coreCanonicalHash: `${fieldKey}:core`,
    gbpCanonicalHash: `${fieldKey}:gbp`,
    capability: {
      canImport: true,
      canExport: true,
      canIgnore: true,
      blockedReasons: [],
    },
    state: 'drifted',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...overrides,
  } satisfies DualSyncFieldSummary;
}
