import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRestaurantDetailsMock = vi.hoisted(() => vi.fn());
const getConnectionStateMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantDetails: getRestaurantDetailsMock,
}));

vi.mock('@/server/google-business-profile/serviceConnectionStateRuntime', () => ({
  getGoogleBusinessProfileConnectionStateForClient: getConnectionStateMock,
}));

import { getGoogleBusinessProfileBusinessDetailsStatusForClient } from '@/server/google-business-profile/serviceBusinessDetailsStatusRuntime';

import type { GoogleBusinessProfileConnectionState } from '@/server/google-business-profile/serviceConnectionStateTypes';

function businessInfo(): GoogleBusinessProfileConnectionState['businessInfo'] {
  return {
    details: {
      businessName: 'Google Business Name',
      description: null,
      languageCode: 'en-GB',
      openingDate: null,
      businessStatus: 'OPEN',
      isServiceAreaBusiness: false,
      canReopen: null,
      source: 'google_business_profile',
      managedBy: 'google_business_profile',
      lastSyncedAt: '2026-05-22T07:00:00.000Z',
    },
    addresses: [
      {
        id: 'address-1',
        addressType: 'business',
        formattedAddress: 'Google address',
        addressLines: [],
        locality: null,
        administrativeArea: null,
        postalCode: null,
        regionCode: null,
        countryCode: null,
        languageCode: null,
        sublocality: null,
        organization: null,
        sortingCode: null,
        recipients: [],
        latlng: null,
        latitude: null,
        longitude: null,
        isPrimary: true,
        lastSyncedAt: null,
      },
    ],
    phoneNumbers: [
      {
        id: 'phone-1',
        phoneKind: 'primary',
        phoneNumber: '+44 20 0000 0000',
        isPrimary: true,
        lastSyncedAt: null,
      },
    ],
    links: [
      {
        id: 'maps',
        linkType: 'google_map',
        linkStatus: 'active',
        label: 'Maps',
        url: 'https://maps.example.com',
        isPrimary: true,
        lastSyncedAt: null,
      },
      {
        id: 'reviews',
        linkType: 'google_review',
        linkStatus: 'active',
        label: 'Reviews',
        url: 'https://reviews.example.com',
        isPrimary: true,
        lastSyncedAt: null,
      },
    ],
    categories: [
      {
        id: 'category-1',
        displayName: 'Restaurant',
        categoryCode: 'gcid:restaurant',
        moreHoursTypes: [],
        isPrimary: true,
        lastSyncedAt: null,
      },
    ],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    coreNormalization: null,
  };
}

function connectionState(
  overrides: Partial<GoogleBusinessProfileConnectionState> = {},
): GoogleBusinessProfileConnectionState {
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
    externalLocationTitle: 'Google Location Title',
    externalPlaceId: 'place-1',
    providerTimezone: 'Europe/London',
    lastPullAt: '2026-05-22T07:00:00.000Z',
    lastPushAt: '2026-05-22T08:00:00.000Z',
    lastError: null,
    availableLocations: [
      {
        accountName: 'accounts/1',
        accountId: 'account-1',
        locationName: 'locations/1',
        locationId: 'location-1',
        title: 'Google Location Title',
        address: null,
        primaryCategory: null,
        placeId: 'place-1',
      },
    ],
    businessInfo: businessInfo(),
    ...overrides,
  };
}

function restaurantProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Local Business Name',
    contactPhone: '+44 20 1111 1111',
    address: 'Local address',
    googleMapUrl: 'https://local-maps.example.com',
    googleReviewUrl: null,
    timezone: 'Europe/London',
    updatedAt: '2026-05-22T06:00:00.000Z',
    ...overrides,
  };
}

describe('google business profile business details status runtime', () => {
  beforeEach(() => {
    getRestaurantDetailsMock.mockReset();
    getConnectionStateMock.mockReset();
  });

  it('assembles the business-details status from connection state and local profile', async () => {
    const client = {} as never;
    getConnectionStateMock.mockResolvedValue(connectionState());
    getRestaurantDetailsMock.mockResolvedValue(restaurantProfile());

    const status = await getGoogleBusinessProfileBusinessDetailsStatusForClient(
      'restaurant-1',
      client,
    );

    expect(getConnectionStateMock).toHaveBeenCalledWith('restaurant-1', client);
    expect(getRestaurantDetailsMock).toHaveBeenCalledWith('restaurant-1', client);
    expect(status.connection).toEqual({
      isConfigured: true,
      provider: 'google_business_profile',
      status: 'connected',
      rawStatus: 'linked',
      connectedGoogleEmail: 'owner@example.com',
      connectedGoogleName: 'Owner',
      lastError: null,
    });
    expect(status.selectedLocation).toMatchObject({
      accountId: 'account-1',
      locationId: 'location-1',
      title: 'Google Location Title',
      address: 'Google address',
      phone: '+44 20 0000 0000',
      mapsUri: 'https://maps.example.com',
      newReviewUri: 'https://reviews.example.com',
    });
    expect(status.lastSync).toEqual({
      pulledAt: '2026-05-22T07:00:00.000Z',
      pushedAt: '2026-05-22T08:00:00.000Z',
    });
    expect(status.fieldDiffs).toEqual([
      expect.objectContaining({
        field: 'name',
        localValue: 'Local Business Name',
        googleValue: 'Google Location Title',
        status: 'different',
      }),
      expect.objectContaining({
        field: 'contactPhone',
        localValue: '+44 20 1111 1111',
        googleValue: '+44 20 0000 0000',
        status: 'different',
      }),
      expect.objectContaining({
        field: 'address',
        localValue: 'Local address',
        googleValue: 'Google address',
        status: 'different',
      }),
      expect.objectContaining({
        field: 'googleMapUrl',
        localValue: 'https://local-maps.example.com',
        googleValue: 'https://maps.example.com',
        status: 'different',
      }),
      expect.objectContaining({
        field: 'googleReviewUrl',
        localValue: null,
        googleValue: 'https://reviews.example.com',
        status: 'missing_local',
      }),
    ]);
    expect(status.availableLocations).toHaveLength(1);
  });

  it('uses the Google business-info name when no linked location title exists', async () => {
    getConnectionStateMock.mockResolvedValue(
      connectionState({
        externalLocationTitle: null,
      }),
    );
    getRestaurantDetailsMock.mockResolvedValue(restaurantProfile({ name: 'Google Business Name' }));

    const status = await getGoogleBusinessProfileBusinessDetailsStatusForClient(
      'restaurant-1',
      {} as never,
    );

    expect(status.fieldDiffs[0]).toMatchObject({
      field: 'name',
      googleValue: 'Google Business Name',
      status: 'matches',
    });
  });
});
