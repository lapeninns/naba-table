import { describe, expect, it } from 'vitest';

import {
  buildFormattedAddress,
  pickGooglePlaceId,
  pickGooglePlaceResourceName,
} from '@/server/google-business-profile/businessInfoPlaceNormalization';

import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';

describe('google business profile business info place normalization', () => {
  it('picks Google place resource names from direct and nested payloads', () => {
    expect(pickGooglePlaceResourceName({ resourceName: ' places/direct ' })).toBe('places/direct');
    expect(pickGooglePlaceResourceName({ place: { name: 'places/nested' } })).toBe('places/nested');
    expect(pickGooglePlaceResourceName({ place: { place_id: 'abc123' } })).toBe('places/abc123');
    expect(pickGooglePlaceResourceName({ unknown: 'value' })).toBeNull();
  });

  it('picks Google place IDs directly or from resource names', () => {
    expect(pickGooglePlaceId({ metadata: { placeId: ' meta-1 ' } })).toBe('meta-1');
    expect(pickGooglePlaceId({ place: { metadata: { placeId: 'nested-meta' } } })).toBe(
      'nested-meta',
    );
    expect(pickGooglePlaceId({ name: 'places/from-name' })).toBe('from-name');
    expect(pickGooglePlaceId({ name: 'accounts/not-a-place' })).toBeNull();
  });

  it('builds formatted storefront addresses from populated address parts', () => {
    expect(
      buildFormattedAddress({
        addressLines: [' 89 High Street ', '', null, 'Village Green'],
        locality: ' Girton ',
        administrativeArea: 'Cambridgeshire',
        postalCode: 'CB3 0QD',
        regionCode: 'GB',
      } as GoogleBusinessProfileLocationProfile['storefrontAddress']),
    ).toBe('89 High Street, Village Green, Girton, Cambridgeshire, CB3 0QD, GB');

    expect(buildFormattedAddress(null)).toBeNull();
    expect(
      buildFormattedAddress({} as GoogleBusinessProfileLocationProfile['storefrontAddress']),
    ).toBeNull();
  });
});
