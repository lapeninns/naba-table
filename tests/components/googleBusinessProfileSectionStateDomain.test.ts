import { describe, expect, it } from 'vitest';

import { buildLocationValue } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';
import {
  deriveGoogleBusinessProfileSectionSummary,
  findGoogleBusinessProfileSelectedLocation,
  mergeGoogleBusinessProfileConnectionData,
  resolveGoogleBusinessProfileSelectedLocationValue,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileSectionStateDomain';

import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

describe('googleBusinessProfileSectionStateDomain', () => {
  it('merges refreshed locations into connection data without mutating missing data', () => {
    const connection = buildConnection({
      availableLocations: [location({ locationId: 'stale', locationName: 'locations/stale' })],
    });
    const refreshed = [location({ locationId: 'fresh', locationName: 'locations/fresh' })];

    expect(
      mergeGoogleBusinessProfileConnectionData({
        availableLocations: refreshed,
        connectionData: connection,
      })?.availableLocations,
    ).toEqual(refreshed);

    expect(
      mergeGoogleBusinessProfileConnectionData({
        availableLocations: refreshed,
        connectionData: undefined,
      }),
    ).toBeUndefined();
  });

  it('resolves selected location value from linked location before the first available fallback', () => {
    const linked = location({ accountName: 'accounts/2', locationName: 'locations/2' });
    const first = location({ accountName: 'accounts/1', locationName: 'locations/1' });
    const data = buildConnection({
      availableLocations: [first, linked],
      externalAccountName: linked.accountName,
      externalLocationName: linked.locationName,
    });

    expect(
      resolveGoogleBusinessProfileSelectedLocationValue({
        data,
        selectedLocationValue: '',
      }),
    ).toBe(buildLocationValue(linked));

    expect(
      findGoogleBusinessProfileSelectedLocation({
        data,
        selectedLocationValue: buildLocationValue(linked),
      }),
    ).toEqual(linked);
  });

  it('keeps an existing manual selection unless no value is selected', () => {
    const first = location({ accountName: 'accounts/1', locationName: 'locations/1' });
    const second = location({ accountName: 'accounts/2', locationName: 'locations/2' });
    const data = buildConnection({
      availableLocations: [first, second],
    });

    expect(
      resolveGoogleBusinessProfileSelectedLocationValue({
        data,
        selectedLocationValue: '',
      }),
    ).toBe(buildLocationValue(first));

    expect(
      resolveGoogleBusinessProfileSelectedLocationValue({
        data,
        selectedLocationValue: buildLocationValue(second),
      }),
    ).toBeNull();
  });

  it('derives connection summary flags and stale-location warning state', () => {
    const data = buildConnection({
      availableLocations: [location()],
      connectedGoogleEmail: 'owner@example.test',
      externalLocationId: 'loc-1',
      externalLocationTitle: 'Nabatable Main',
      externalPlaceId: 'place-1',
      status: 'sync_error',
    });

    expect(
      deriveGoogleBusinessProfileSectionSummary({
        data,
        locationsError: new Error('Locations unavailable'),
      }),
    ).toMatchObject({
      accountLabel: 'owner@example.test',
      canDisconnect: true,
      canRefresh: true,
      hasLinkedLocation: true,
      isLinked: true,
      locationTitle: 'Nabatable Main',
      locationsArePossiblyStale: true,
      locationsErrorMessage: 'Locations unavailable',
      manageOnGoogleHref: 'https://www.google.com/maps/search/?api=1&query_place_id=place-1',
      showConnect: false,
      showPicker: false,
      stage: 'issue',
      stageLabel: 'Action needed',
      status: 'sync_error',
    });
  });
});

function location(
  overrides: Partial<GoogleBusinessProfileAvailableLocation> = {},
): GoogleBusinessProfileAvailableLocation {
  return {
    accountDisplayName: overrides.accountDisplayName ?? 'Owner account',
    accountId: overrides.accountId ?? 'account-id',
    accountName: overrides.accountName ?? 'accounts/1',
    addressText: overrides.addressText ?? '1 High Street',
    locationId: overrides.locationId ?? 'location-id',
    locationName: overrides.locationName ?? 'locations/1',
    placeId: overrides.placeId ?? 'place-id',
    title: overrides.title ?? 'Nabatable',
  };
}

function buildConnection(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileConnection {
  return {
    availableLocations: [],
    businessInfo: {
      addresses: [],
      attributes: [],
      categories: [],
      coreNormalization: {
        bookingHours: {
          matchStatus: 'unavailable',
          missingInputs: [],
          summary: '',
          warnings: [],
        },
        operatingHours: {
          matchStatus: 'unavailable',
          overrides: [],
          source: 'unavailable',
          summary: '',
          warnings: [],
          weekly: [],
        },
        servicePeriods: {
          matchStatus: 'unavailable',
          periods: [],
          source: 'unavailable',
          summary: '',
          warnings: [],
        },
      },
      details: null,
      hours: [],
      links: [],
      phoneNumbers: [],
      serviceAreas: [],
      serviceItems: [],
    },
    connectedGoogleEmail: null,
    connectedGoogleName: null,
    externalAccountId: null,
    externalAccountName: null,
    externalLocationId: null,
    externalLocationName: null,
    externalLocationTitle: null,
    externalPlaceId: null,
    isConfigured: true,
    lastError: null,
    lastPullAt: null,
    lastPushAt: null,
    provider: 'google_business_profile',
    pushEnabled: true,
    status: 'unlinked',
    ...overrides,
  };
}
