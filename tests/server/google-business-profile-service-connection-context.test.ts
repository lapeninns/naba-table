import { describe, expect, it } from 'vitest';

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  assertGoogleBusinessProfileLocationLinked,
  assertGoogleFoodMenusEligible,
  assertGooglePushEnabled,
  buildConnectionState,
  createGoogleBusinessProfileAccountNotLinkedError,
  createGoogleBusinessProfileLocationNotLinkedError,
  createGoogleBusinessProfileLocationNotFoundError,
  findSelectedGoogleBusinessProfileLocation,
  normalizeGoogleBusinessProfileText,
  pickProviderTimezone,
  resolveCanHaveFoodMenus,
  resolveGoogleBusinessProfileAccountNameOrId,
  resolveLinkedLocationResourceName,
} from '@/server/google-business-profile/serviceConnectionContext';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';

type BuildConnectionStateParams = Parameters<typeof buildConnectionState>[0];

const businessInfo = {} as GoogleBusinessProfileBusinessInfo;
const availableLocation = {
  accountName: 'accounts/1',
  accountId: 'account-1',
  locationName: 'locations/1',
  locationId: 'location-1',
  title: 'The Crown',
  address: null,
  primaryCategory: null,
  placeId: 'place-1',
};

function location(
  overrides: Partial<GoogleBusinessProfileLocationProfile>,
): GoogleBusinessProfileLocationProfile {
  return overrides as GoogleBusinessProfileLocationProfile;
}

describe('google business profile service connection context domain', () => {
  it('normalizes optional Google text values', () => {
    expect(normalizeGoogleBusinessProfileText(null)).toBeNull();
    expect(normalizeGoogleBusinessProfileText(undefined)).toBeNull();
    expect(normalizeGoogleBusinessProfileText('   ')).toBeNull();
    expect(normalizeGoogleBusinessProfileText('  accounts/123  ')).toBe('accounts/123');
  });

  it('selects provider timezone using Google location precedence', () => {
    expect(
      pickProviderTimezone(
        location({
          timezone: ' Europe/London ',
          timeZone: 'America/New_York',
          metadata: { timezone: 'Asia/Kathmandu', timeZone: 'Europe/Paris' },
        }),
      ),
    ).toBe('Europe/London');

    expect(
      pickProviderTimezone(
        location({
          timezone: ' ',
          timeZone: ' America/New_York ',
          metadata: { timezone: 'Asia/Kathmandu' },
        }),
      ),
    ).toBe('America/New_York');

    expect(
      pickProviderTimezone(
        location({
          metadata: { timezone: ' Asia/Kathmandu ', timeZone: 'Europe/Paris' },
        }),
      ),
    ).toBe('Asia/Kathmandu');
  });

  it('builds an unlinked connection state when no external profile exists', () => {
    expect(
      buildConnectionState({
        isConfigured: false,
        externalProfile: null,
        credential: null,
        availableLocations: [],
        businessInfo,
      }),
    ).toMatchObject({
      isConfigured: false,
      provider: 'google_business_profile',
      status: 'unlinked',
      pushEnabled: false,
      connectedGoogleEmail: null,
      externalLocationId: null,
      availableLocations: [],
      businessInfo,
    });
  });

  it('builds a linked connection state from profile and credential rows', () => {
    const externalProfile: NonNullable<BuildConnectionStateParams['externalProfile']> = {
      connection_status: 'linked',
      push_enabled: true,
      external_account_id: 'account-1',
      external_account_name: 'accounts/1',
      external_location_id: 'location-1',
      external_location_name: 'locations/1',
      external_location_title: 'The Crown',
      external_place_id: 'place-1',
      provider_timezone: 'Europe/London',
      last_pull_at: '2026-05-01T10:00:00.000Z',
      last_push_at: '2026-05-01T11:00:00.000Z',
      last_error: null,
    };
    const credential: NonNullable<BuildConnectionStateParams['credential']> = {
      connected_google_email: 'owner@example.com',
      connected_google_name: 'Owner',
    };

    expect(
      buildConnectionState({
        isConfigured: true,
        externalProfile,
        credential,
        availableLocations: [
          {
            accountName: 'accounts/1',
            accountId: 'account-1',
            locationName: 'locations/1',
            locationId: 'location-1',
            title: 'The Crown',
            address: null,
            primaryCategory: null,
            placeId: 'place-1',
          },
        ],
        businessInfo,
      }),
    ).toMatchObject({
      isConfigured: true,
      status: 'linked',
      pushEnabled: true,
      connectedGoogleEmail: 'owner@example.com',
      connectedGoogleName: 'Owner',
      externalAccountId: 'account-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'location-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'The Crown',
      externalPlaceId: 'place-1',
      providerTimezone: 'Europe/London',
      lastPullAt: '2026-05-01T10:00:00.000Z',
      lastPushAt: '2026-05-01T11:00:00.000Z',
    });
  });

  it('guards Google push when the linked profile has push disabled', () => {
    expect(() => assertGooglePushEnabled({ push_enabled: true })).not.toThrow();
    expect(() => assertGooglePushEnabled({ push_enabled: false })).toThrow(
      GoogleBusinessProfileError,
    );
    expect(() => assertGooglePushEnabled({ push_enabled: false })).toThrow(
      'Optional Nabatable -> Google sync is disabled',
    );
  });

  it('guards linked-location requirements with a stable domain error', () => {
    expect(createGoogleBusinessProfileLocationNotLinkedError()).toMatchObject({
      code: 'GBP_LOCATION_NOT_LINKED',
      status: 409,
      message: 'Link a Google Business Profile location before syncing business information.',
    });
    expect(() =>
      assertGoogleBusinessProfileLocationLinked({
        external_location_id: '456',
        external_resource_name: null,
      }),
    ).not.toThrow();
    expect(() =>
      assertGoogleBusinessProfileLocationLinked({
        external_location_id: null,
        external_resource_name: 'locations/456',
      }),
    ).not.toThrow();

    try {
      assertGoogleBusinessProfileLocationLinked({
        external_location_id: null,
        external_resource_name: null,
      });
      throw new Error('Expected linked-location guard to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleBusinessProfileError);
      expect(error).toMatchObject({
        code: 'GBP_LOCATION_NOT_LINKED',
        status: 409,
      });
    }
  });

  it('resolves linked-location resource names with the existing fallback order', () => {
    expect(
      resolveLinkedLocationResourceName({
        external_location_id: '456',
        external_location_name: 'locations/from-name',
        external_resource_name: 'locations/from-resource',
      }),
    ).toBe('locations/from-resource');

    expect(
      resolveLinkedLocationResourceName({
        external_location_id: '456',
        external_location_name: 'locations/from-name',
        external_resource_name: null,
      }),
    ).toBe('locations/from-name');

    expect(
      resolveLinkedLocationResourceName({
        external_location_id: '456',
        external_location_name: null,
        external_resource_name: null,
      }),
    ).toBe('locations/456');

    expect(() =>
      resolveLinkedLocationResourceName({
        external_location_id: null,
        external_location_name: 'locations/from-name',
        external_resource_name: null,
      }),
    ).toThrow(GoogleBusinessProfileError);
  });

  it('selects discovered Google locations by exact account and location identifiers', () => {
    expect(
      findSelectedGoogleBusinessProfileLocation(
        [
          {
            ...availableLocation,
            accountId: 'other-account',
          },
          availableLocation,
        ],
        {
          accountName: 'accounts/1',
          accountId: 'account-1',
          locationName: 'locations/1',
          locationId: 'location-1',
        },
      ),
    ).toBe(availableLocation);
  });

  it('throws a stable error when the selected Google location is unavailable', () => {
    expect(createGoogleBusinessProfileLocationNotFoundError()).toMatchObject({
      code: 'GBP_LOCATION_NOT_FOUND',
      status: 404,
      message: 'The selected Google Business Profile location is no longer available.',
    });

    try {
      findSelectedGoogleBusinessProfileLocation([availableLocation], {
        accountName: 'accounts/1',
        accountId: 'account-1',
        locationName: 'locations/2',
        locationId: 'location-2',
      });
      throw new Error('Expected location selection to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleBusinessProfileError);
      expect(error).toMatchObject({
        code: 'GBP_LOCATION_NOT_FOUND',
        status: 404,
      });
    }
  });

  it('resolves linked account identity with account-name precedence', () => {
    expect(
      resolveGoogleBusinessProfileAccountNameOrId({
        external_account_name: ' accounts/123 ',
        external_account_id: '456',
      }),
    ).toBe('accounts/123');

    expect(
      resolveGoogleBusinessProfileAccountNameOrId({
        external_account_name: ' ',
        external_account_id: ' 456 ',
      }),
    ).toBe('456');
  });

  it('throws a stable error when no Google account is linked', () => {
    expect(createGoogleBusinessProfileAccountNotLinkedError()).toMatchObject({
      code: 'GBP_ACCOUNT_NOT_LINKED',
      status: 409,
      message: 'Link a Google Business Profile account before syncing food menus.',
    });

    try {
      resolveGoogleBusinessProfileAccountNameOrId({
        external_account_name: null,
        external_account_id: ' ',
      });
      throw new Error('Expected account identity resolution to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleBusinessProfileError);
      expect(error).toMatchObject({
        code: 'GBP_ACCOUNT_NOT_LINKED',
        status: 409,
      });
    }
  });

  it('resolves FoodMenus eligibility using Google metadata before location state fallbacks', () => {
    expect(
      resolveCanHaveFoodMenus(
        location({
          metadata: { canHaveFoodMenus: true },
          locationState: { canHaveFoodMenu: false, canHaveFoodMenus: false },
        }),
      ),
    ).toBe(true);

    expect(
      resolveCanHaveFoodMenus(
        location({
          locationState: { canHaveFoodMenu: true },
        }),
      ),
    ).toBe(true);

    expect(
      resolveCanHaveFoodMenus(
        location({
          locationState: { canHaveFoodMenus: false },
        }),
      ),
    ).toBe(false);

    expect(resolveCanHaveFoodMenus(location({}))).toBeNull();
  });

  it('throws a stable domain error when Google marks FoodMenus as ineligible', () => {
    expect(
      assertGoogleFoodMenusEligible(
        location({
          metadata: { canHaveFoodMenus: true },
        }),
      ),
    ).toBe(true);

    try {
      assertGoogleFoodMenusEligible(
        location({
          metadata: { canHaveFoodMenus: false },
        }),
      );
      throw new Error('Expected FoodMenus eligibility guard to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleBusinessProfileError);
      expect(error).toMatchObject({
        code: 'GBP_FOOD_MENUS_NOT_ELIGIBLE',
        status: 409,
      });
    }
  });
});
