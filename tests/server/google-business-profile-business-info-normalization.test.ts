import { describe, expect, it } from 'vitest';

import {
  buildFormattedAddress,
  deriveServiceItemKey,
  googleDayToNumber,
  humanizeIdentifier,
  normalizeGoogleDate,
  normalizeGoogleTime,
  pickGooglePlaceId,
  pickGooglePlaceResourceName,
  pickServiceItemDescription,
  pickServiceItemDisplayName,
  pickServiceItemType,
  shouldSyncLocationServiceItems,
} from '@/server/google-business-profile/businessInfoNormalization';

import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';

describe('google business profile business info normalization', () => {
  it('normalizes Google time and date payload shapes', () => {
    expect(normalizeGoogleTime('9:05:00')).toBe('09:05');
    expect(normalizeGoogleTime({ hours: 24, minutes: 0 })).toBe('24:00');
    expect(normalizeGoogleTime({ hours: 25, minutes: 0 })).toBeNull();
    expect(normalizeGoogleTime('9:5')).toBeNull();

    expect(normalizeGoogleDate({ year: 2026, month: 5, day: 7 })).toBe('2026-05-07');
    expect(normalizeGoogleDate({ year: 0, month: 5, day: 7 })).toBeNull();
    expect(googleDayToNumber(' friday ')).toBe(5);
    expect(googleDayToNumber('weekday')).toBeNull();
  });

  it('normalizes Google place identifiers from direct and nested payloads', () => {
    expect(pickGooglePlaceResourceName({ place: { placeId: 'abc123' } })).toBe('places/abc123');
    expect(pickGooglePlaceResourceName({ place: { resourceName: 'places/xyz789' } })).toBe(
      'places/xyz789',
    );
    expect(pickGooglePlaceId({ metadata: { placeId: 'meta-1' } })).toBe('meta-1');
    expect(pickGooglePlaceId({ name: 'places/from-name' })).toBe('from-name');
  });

  it('builds formatted addresses from populated storefront address parts', () => {
    expect(
      buildFormattedAddress({
        addressLines: [' 1 High Street ', null, ''],
        locality: 'London',
        administrativeArea: 'Greater London',
        postalCode: 'SW1A 1AA',
        regionCode: 'GB',
      } as GoogleBusinessProfileLocationProfile['storefrontAddress']),
    ).toBe('1 High Street, London, Greater London, SW1A 1AA, GB');
  });

  it('derives service item display fields and stable fallback keys', () => {
    const item = {
      title: '  Private Dining ',
      serviceType: 'event',
      shortDescription: 'Configured from Google',
    };

    expect(pickServiceItemDisplayName(item)).toBe('Private Dining');
    expect(pickServiceItemType(item)).toBe('event');
    expect(pickServiceItemDescription(item)).toBe('Configured from Google');
    expect(deriveServiceItemKey({ itemId: ' menu-1 ' }, 0)).toBe('menu-1');
    expect(deriveServiceItemKey({ title: 'Fallback only' }, 2)).toMatch(
      /^service_item_2_[a-f0-9]{16}$/,
    );
  });

  it('respects optional service item fetch status from the location payload', () => {
    expect(
      shouldSyncLocationServiceItems({
        __nabatableOptionalFetchStatus: { serviceItems: 'unavailable' },
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(false);
    expect(
      shouldSyncLocationServiceItems({
        __nabatableOptionalFetchStatus: { serviceItems: 'fetched' },
      } as GoogleBusinessProfileLocationProfile),
    ).toBe(true);
    expect(
      shouldSyncLocationServiceItems({
        serviceItems: [],
      } as unknown as GoogleBusinessProfileLocationProfile),
    ).toBe(true);
  });

  it('humanizes provider identifiers for fallback labels', () => {
    expect(humanizeIdentifier('business.services_table-service')).toBe(
      'Business Services Table Service',
    );
    expect(humanizeIdentifier('   ')).toBeNull();
  });
});
