import { describe, expect, it } from 'vitest';

import {
  buildProfileVerificationSummary,
  buildPullProfilePatch,
  buildPushProfileLocationPatch,
} from '@/server/google-business-profile/core-sync-profile';

import type { GoogleBusinessProfileBusinessInfo } from '@/server/google-business-profile/business-info';
import type { GoogleBusinessProfileLocationProfile } from '@/server/google-business-profile/client';
import type { RestaurantDetails } from '@/server/restaurants/details';

function makeProfile(overrides: Partial<RestaurantDetails> = {}): RestaurantDetails {
  return {
    id: 'rest-1',
    name: 'Nabatable Curry House',
    slug: 'nabatable-curry-house',
    description: null,
    address: '1 High Street, London',
    contactPhone: '+44 20 7000 0000',
    email: 'hello@example.com',
    website: 'https://example.com',
    timezone: 'Europe/London',
    googleMapUrl: 'https://maps.google.com/?cid=123',
    googleReviewUrl: 'https://search.google.com/local/writereview?placeid=abc',
    cuisineTypes: [],
    diningStyles: [],
    priceRange: null,
    dressCode: null,
    parkingInfo: null,
    publicTransport: null,
    paymentOptions: [],
    executiveChef: null,
    privatePartyContact: null,
    catering: null,
    specialEvents: null,
    updatedAt: '2026-05-01T12:00:00.000Z',
    ...overrides,
  } as RestaurantDetails;
}

function makeBusinessInfo(
  overrides: Partial<GoogleBusinessProfileBusinessInfo> = {},
): GoogleBusinessProfileBusinessInfo {
  return {
    details: null,
    addresses: [
      {
        id: 'addr-1',
        addressKind: 'physical',
        formattedAddress: '1 High Street, London',
        isPrimary: true,
      },
    ],
    phoneNumbers: [
      {
        id: 'phone-1',
        phoneKind: 'primary',
        phoneNumber: '+44 20 7000 0000',
        isPrimary: true,
      },
    ],
    links: [
      {
        id: 'link-1',
        linkType: 'google_map',
        url: 'https://maps.google.com/?cid=123',
        isPrimary: true,
      },
      {
        id: 'link-2',
        linkType: 'google_review',
        url: 'https://search.google.com/local/writereview?placeid=abc',
        isPrimary: true,
      },
    ],
    serviceAreas: [],
    serviceItems: [],
    attributes: [],
    coreNormalization: {
      operatingHours: {
        matchStatus: 'matched',
        source: 'regular_hours',
        summary: 'Operating hours match.',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        matchStatus: 'matched',
        source: 'regular_hours',
        summary: 'Service periods match.',
        warnings: [],
        periods: [],
      },
    },
    updatedAt: '2026-05-02T12:00:00.000Z',
    ...overrides,
  } as GoogleBusinessProfileBusinessInfo;
}

describe('google business profile core-sync profile domain', () => {
  it('builds verified profile summaries when normalized profile fields match', () => {
    const summary = buildProfileVerificationSummary({
      profile: makeProfile(),
      businessInfo: makeBusinessInfo(),
      externalLocationTitle: 'Nabatable Curry House',
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
    });

    expect(summary.status).toBe('verified');
    expect(summary.recommendedDirection).toBeNull();
    expect(summary.canPull).toBe(false);
    expect(summary.canPush).toBe(false);
    expect(summary.fields.map((field) => field.status)).toEqual([
      'verified',
      'verified',
      'verified',
      'verified',
      'verified',
    ]);
    expect(summary.providerUpdatedAt).toBe('2026-05-02T12:00:00.000Z');
  });

  it('detects drift and recommends the newer push direction for editable fields', () => {
    const summary = buildProfileVerificationSummary({
      profile: makeProfile({
        name: 'New Nabatable Name',
        contactPhone: '+44 20 7111 1111',
        updatedAt: '2026-05-03T12:00:00.000Z',
      }),
      businessInfo: makeBusinessInfo(),
      externalLocationTitle: 'Nabatable Curry House',
      lastPulledAt: '2026-05-02T12:00:00.000Z',
      lastPushedAt: '2026-05-01T12:00:00.000Z',
    });

    expect(summary.status).toBe('drifted');
    expect(summary.recommendedDirection).toBe('push_to_gbp');
    expect(summary.canPull).toBe(true);
    expect(summary.canPush).toBe(true);
    expect(summary.fields.find((field) => field.field === 'name')?.status).toBe('drifted');
    expect(summary.fields.find((field) => field.field === 'contactPhone')?.status).toBe('drifted');
  });

  it('builds pull patches from selected Google-owned profile values', () => {
    expect(
      buildPullProfilePatch({
        businessInfo: makeBusinessInfo(),
        externalLocationTitle: 'Google Restaurant Name',
        fields: ['name', 'contactPhone', 'googleMapUrl'],
      }),
    ).toEqual({
      name: 'Google Restaurant Name',
      contactPhone: '+44 20 7000 0000',
      googleMapUrl: 'https://maps.google.com/?cid=123',
    });
  });

  it('builds push patches for supported editable fields and rejects address exports', () => {
    expect(
      buildPushProfileLocationPatch({
        profile: makeProfile({
          name: '  New Nabatable Name  ',
          contactPhone: ' +44 20 7111 1111 ',
        }),
        location: {
          name: 'accounts/123/locations/456',
          phoneNumbers: { additionalPhones: ['+44 20 7222 2222'] },
        } as GoogleBusinessProfileLocationProfile,
        fields: ['name', 'contactPhone'],
      }),
    ).toEqual({
      payload: {
        title: 'New Nabatable Name',
        phoneNumbers: {
          primaryPhone: '+44 20 7111 1111',
          additionalPhones: ['+44 20 7222 2222'],
        },
      },
      updateMask: ['title', 'phoneNumbers'],
    });

    expect(() =>
      buildPushProfileLocationPatch({
        profile: makeProfile(),
        location: { name: 'accounts/123/locations/456' } as GoogleBusinessProfileLocationProfile,
        fields: ['address'],
      }),
    ).toThrow('not safely pushable');
  });
});
