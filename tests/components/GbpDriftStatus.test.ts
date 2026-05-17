import { describe, expect, it } from 'vitest';

import { deriveGbpDriftStatus } from '@/components/features/restaurant-settings/gbpDriftStatus';

import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

function connection(
  status: GoogleBusinessProfileConnection['status'] = 'linked',
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status,
    pushEnabled: true,
    connectedGoogleEmail: 'ops@example.com',
    connectedGoogleName: null,
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'location-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Old Crown Girton',
    externalPlaceId: null,
    lastPullAt: '2026-05-17T12:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {
      details: null,
      addresses: [],
      phoneNumbers: [],
      links: [],
      categories: [],
      serviceAreas: [],
      hours: [],
      attributes: [],
      serviceItems: [],
      coreNormalization: {
        operatingHours: {
          source: 'unavailable',
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          weekly: [],
          overrides: [],
        },
        servicePeriods: {
          source: 'unavailable',
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          periods: [],
        },
        bookingHours: {
          matchStatus: 'unavailable',
          summary: '',
          warnings: [],
          missingInputs: [],
        },
      },
    },
  };
}

function field(
  fieldKey: string,
  sectionKey: DualSyncFieldSummary['sectionKey'],
  state: DualSyncFieldSummary['state'],
): DualSyncFieldSummary {
  return {
    fieldKey,
    sectionKey,
    kind: 'scalar',
    label: fieldKey,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {} as DualSyncFieldSummary['policy'],
    importable: true,
    exportable: true,
    sortOrder: 1,
    coreValue: null,
    gbpValue: null,
    coreCanonicalHash: 'core-hash',
    gbpCanonicalHash: 'gbp-hash',
    capability: {
      canImport: true,
      canExport: true,
      canIgnore: true,
      importDisabledReason: null,
      exportDisabledReason: null,
    },
    state,
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
  };
}

function state(fields: DualSyncFieldSummary[]): GetDualSyncStateResponse {
  return {
    restaurantId: 'rest-1',
    coreSnapshot: {} as GetDualSyncStateResponse['coreSnapshot'],
    gbpSnapshot: {} as GetDualSyncStateResponse['gbpSnapshot'],
    coreSnapshotHash: 'core-snapshot',
    gbpSnapshotHash: 'gbp-snapshot',
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
      startedAt: '2026-05-17T12:00:00.000Z',
      finishedAt: '2026-05-17T12:01:00.000Z',
    },
    control: {} as GetDualSyncStateResponse['control'],
  };
}

describe('deriveGbpDriftStatus', () => {
  it('reports not connected before a Google location is linked', () => {
    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection('unlinked'),
      dualSyncState: null,
    });

    expect(status.kind).toBe('not_connected');
    expect(status.shortLabel).toBe('Link Google');
  });

  it('summarizes reviewable drift across settings sections', () => {
    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection(),
      dualSyncState: state([
        field('profile.name', 'profile', 'drifted'),
        field('hours.monday', 'operatingHours', 'conflict'),
        field('foodMenus.item.burrata', 'foodMenus', 'in_sync'),
      ]),
      now: new Date('2026-05-17T12:05:00.000Z'),
    });

    expect(status.kind).toBe('connected_with_review');
    expect(status.needsReviewCount).toBe(2);
    expect(status.sectionReviewCounts).toEqual({
      profile: 1,
      availability: 1,
      menu: 0,
      googleBusinessProfile: 2,
    });
  });

  it('marks a linked profile as stale when no fresh snapshot exists', () => {
    const staleState = state([field('profile.name', 'profile', 'in_sync')]);
    staleState.lastSnapshot = {
      runId: 'run-1',
      runKind: 'manual',
      startedAt: '2026-05-15T12:00:00.000Z',
      finishedAt: '2026-05-15T12:01:00.000Z',
    };

    const status = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: connection(),
      dualSyncState: staleState,
      now: new Date('2026-05-17T12:05:00.000Z'),
    });

    expect(status.kind).toBe('connected_outdated');
    expect(status.shortLabel).toBe('Refresh');
  });
});

