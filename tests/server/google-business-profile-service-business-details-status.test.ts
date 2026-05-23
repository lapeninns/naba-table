import { describe, expect, it } from 'vitest';

import {
  buildFieldDiff,
  buildSelectedLocation,
  getPrimaryBusinessInfoValues,
  mapBusinessDetailsConnectionStatus,
  normalizeComparableText,
} from '@/server/google-business-profile/serviceBusinessDetailsStatus';

import type { GoogleBusinessProfileConnectionState } from '@/server/google-business-profile/service';

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
    externalLocationTitle: 'The Test Restaurant',
    externalPlaceId: 'place-1',
    providerTimezone: 'Europe/London',
    lastPullAt: '2026-05-01T10:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: {
      details: {
        businessName: 'The Test Restaurant',
        description: null,
        languageCode: 'en-GB',
        openingDate: null,
        businessStatus: 'OPEN',
        isServiceAreaBusiness: false,
        canReopen: null,
        source: 'google_business_profile',
        managedBy: 'google_business_profile',
        lastSyncedAt: '2026-05-01T10:00:00.000Z',
      },
      addresses: [
        {
          id: 'address-fallback',
          addressType: 'business',
          formattedAddress: 'Fallback address',
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
          isPrimary: false,
          lastSyncedAt: null,
        },
        {
          id: 'address-primary',
          addressType: 'business',
          formattedAddress: 'Primary address',
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
          id: 'phone-primary',
          phoneKind: 'primary',
          phoneNumber: '+44 20 0000 0000',
          isPrimary: true,
          lastSyncedAt: null,
        },
      ],
      links: [
        {
          id: 'website',
          linkType: 'website',
          linkStatus: 'active',
          label: 'Website',
          url: 'https://example.com',
          isPrimary: true,
          lastSyncedAt: null,
        },
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
          id: 'review',
          linkType: 'google_review',
          linkStatus: 'active',
          label: 'Review',
          url: 'https://reviews.example.com',
          isPrimary: true,
          lastSyncedAt: null,
        },
      ],
      categories: [
        {
          id: 'category-primary',
          displayName: 'Indian restaurant',
          categoryCode: 'gcid:indian_restaurant',
          moreHoursTypes: [],
          isPrimary: true,
          lastSyncedAt: null,
        },
      ],
      serviceAreas: [],
      hours: [],
      attributes: [],
      serviceItems: [],
      coreNormalization:
        {} as GoogleBusinessProfileConnectionState['businessInfo']['coreNormalization'],
    },
    ...overrides,
  };
}

describe('google business profile service business details status domain', () => {
  it('maps raw connection statuses to business-details statuses', () => {
    expect(mapBusinessDetailsConnectionStatus('pending_auth')).toBe('pending_auth');
    expect(mapBusinessDetailsConnectionStatus('authorized')).toBe('connected');
    expect(mapBusinessDetailsConnectionStatus('linked')).toBe('connected');
    expect(mapBusinessDetailsConnectionStatus('reauth_required')).toBe('needs_reauth');
    expect(mapBusinessDetailsConnectionStatus('sync_error')).toBe('sync_failed');
    expect(mapBusinessDetailsConnectionStatus('unlinked')).toBe('not_connected');
  });

  it('normalizes comparable text and builds field diffs', () => {
    expect(normalizeComparableText('  The   Crown  ')).toBe('the crown');
    expect(
      buildFieldDiff({
        field: 'name',
        label: 'Business name',
        localValue: 'The Crown',
        googleValue: ' The   Crown ',
      }),
    ).toMatchObject({ status: 'matches', suggestion: null });
    expect(
      buildFieldDiff({
        field: 'contactPhone',
        label: 'Phone',
        localValue: null,
        googleValue: '+44 20 0000 0000',
      }),
    ).toMatchObject({ status: 'missing_local', suggestion: '+44 20 0000 0000' });
    expect(
      buildFieldDiff({
        field: 'address',
        label: 'Address',
        localValue: 'Local',
        googleValue: 'Google',
      }),
    ).toMatchObject({ status: 'different', suggestion: 'Google' });
  });

  it('selects primary business info values with fallback order', () => {
    expect(getPrimaryBusinessInfoValues(connectionState())).toEqual({
      address: 'Primary address',
      phone: '+44 20 0000 0000',
      primaryCategory: 'Indian restaurant',
      websiteUri: 'https://example.com',
      mapsUri: 'https://maps.example.com',
      newReviewUri: 'https://reviews.example.com',
    });
  });

  it('builds selected location only when a location is linked', () => {
    expect(
      buildSelectedLocation(
        connectionState({
          externalLocationId: null,
          externalLocationName: null,
        }),
      ),
    ).toBeNull();

    expect(buildSelectedLocation(connectionState())).toEqual({
      accountId: 'account-1',
      accountName: 'accounts/1',
      locationId: 'location-1',
      locationName: 'locations/1',
      title: 'The Test Restaurant',
      address: 'Primary address',
      phone: '+44 20 0000 0000',
      websiteUri: 'https://example.com',
      primaryCategory: 'Indian restaurant',
      placeId: 'place-1',
      mapsUri: 'https://maps.example.com',
      newReviewUri: 'https://reviews.example.com',
    });
  });
});
