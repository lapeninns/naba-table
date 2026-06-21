import { describe, expect, it } from 'vitest';

import { deriveGbpDriftStatus } from '@/components/features/restaurant-settings/gbpDriftStatus';

import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

function connection(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'owner@example.com',
    connectedGoogleName: 'Owner',
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'location-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Old Crown',
    externalPlaceId: 'place-1',
    providerTimezone: 'Europe/London',
    lastPullAt: '2099-05-17T10:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {} as GoogleBusinessProfileConnection['businessInfo'],
    ...overrides,
  };
}

function field(
  overrides: Partial<DualSyncFieldSummary> & Pick<DualSyncFieldSummary, 'fieldKey' | 'sectionKey'>,
): DualSyncFieldSummary {
  return {
    kind: 'scalar',
    label: overrides.fieldKey,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {} as DualSyncFieldSummary['policy'],
    importable: true,
    exportable: true,
    sortOrder: 1,
    coreValue: 'core',
    gbpValue: 'google',
    coreCanonicalHash: 'core-hash',
    gbpCanonicalHash: 'gbp-hash',
    capability: {
      canImport: true,
      canExport: true,
      canIgnore: true,
      blockedReasons: [],
    },
    state: 'in_sync',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...overrides,
  };
}

function state(fields: DualSyncFieldSummary[]): GetDualSyncStateResponse {
  return {
    restaurantId: 'rest-1',
    coreSnapshot: {} as GetDualSyncStateResponse['coreSnapshot'],
    gbpSnapshot: {} as GetDualSyncStateResponse['gbpSnapshot'],
    coreSnapshotHash: 'core',
    gbpSnapshotHash: 'gbp',
    fields,
    outboundQueue: {
      totalOpen: 0,
      autoExportable: 0,
      missingBaseline: 0,
      lastQueuedAt: null,
    },
    lastSnapshot: {
      runId: 'run-1',
      runKind: 'manual',
      startedAt: '2099-05-17T10:00:00.000Z',
      finishedAt: '2099-05-17T10:01:00.000Z',
    },
    control: {} as GetDualSyncStateResponse['control'],
  };
}

describe('deriveGbpDriftStatus', () => {
  it('returns notConnected until a GBP location is linked', () => {
    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection({
        status: 'authorized',
        externalLocationId: null,
        externalLocationName: null,
        externalLocationTitle: null,
      }),
      dualSyncState: null,
    });

    expect(status.kind).toBe('not_connected');
    expect(status.isLinked).toBe(false);
    expect(status.shortLabel).toBe('Link Google');
  });

  it('counts review fields by settings section', () => {
    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection(),
      dualSyncState: state([
        field({ fieldKey: 'profile.name', sectionKey: 'profile', state: 'drifted' }),
        field({
          fieldKey: 'businessContext.categories',
          sectionKey: 'businessContext.categories',
          state: 'conflict',
        }),
        field({
          fieldKey: 'operatingHours.weekly',
          sectionKey: 'operatingHours',
          state: 'gbp_dirty',
        }),
        field({ fieldKey: 'foodMenus.item', sectionKey: 'foodMenus', state: 'in_sync' }),
      ]),
    });

    expect(status.kind).toBe('connected_with_review');
    expect(status.needsReviewCount).toBe(3);
    expect(status.sectionStatuses.profile.needsReviewCount).toBe(1);
    expect(status.sectionStatuses['businessContext.categories'].needsReviewCount).toBe(1);
    expect(status.sectionStatuses.operatingHours.needsReviewCount).toBe(1);
    expect(status.sectionStatuses.foodMenus.needsReviewCount).toBe(0);
  });

  it('marks linked GBP as synced when all comparison fields match', () => {
    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection(),
      dualSyncState: state([
        field({ fieldKey: 'profile.name', sectionKey: 'profile', state: 'in_sync' }),
        field({ fieldKey: 'foodMenus.item', sectionKey: 'foodMenus', state: 'in_sync' }),
      ]),
    });

    expect(status.kind).toBe('synced');
    expect(status.shortLabel).toBe('Synced');
    expect(status.inSyncCount).toBe(2);
  });
});
