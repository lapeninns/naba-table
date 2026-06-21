import { describe, expect, it } from 'vitest';

import { deriveProfileVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';

import type {
  GoogleBusinessProfileConnection,
  RestaurantProfile,
} from '@/services/ops/restaurants';

function emptyBusinessInfo(): GoogleBusinessProfileConnection['businessInfo'] {
  return {
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
  };
}

function buildConnection(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'owner@example.com',
    connectedGoogleName: 'Owner',
    externalAccountId: 'acct-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'loc-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Old Crown Girton',
    externalPlaceId: 'place-1',
    lastPullAt: '2026-04-18T12:00:00.000Z',
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: emptyBusinessInfo(),
    ...overrides,
  };
}

function buildProfile(overrides: Partial<RestaurantProfile> = {}): RestaurantProfile {
  return {
    id: 'rest-1',
    name: 'Old Crown Girton',
    slug: 'old-crown-girton',
    timezone: 'Europe/London',
    capacity: null,
    contactEmail: null,
    contactPhone: '+44 20 1234 5678',
    address: '1 High Street, Cambridge',
    businessDescription: 'Village pub and dining room.',
    managerDailySummaryEnabled: false,
    managerNotificationPhone: null,
    googleMapUrl: 'https://maps.google.com/?cid=abc',
    googleReviewUrl: 'https://search.google.com/local/writereview?placeid=place-1',
    bookingPolicy: null,
    logoUrl: null,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
    updatedAt: '2026-04-17T12:00:00.000Z',
    ...overrides,
  };
}

describe('deriveProfileVerification', () => {
  it('returns unavailable profile verification without a linked GBP connection', () => {
    const verification = deriveProfileVerification({
      profile: buildProfile(),
      connection: buildConnection({ status: 'unlinked' }),
    });

    expect(verification.status).toBe('unavailable');
    expect(verification.canPull).toBe(false);
    expect(verification.canPush).toBe(false);
    expect(verification.fields.name.status).toBe('unavailable');
  });

  it('verifies matching profile fields from GBP snapshots', () => {
    const verification = deriveProfileVerification({
      profile: buildProfile(),
      connection: buildConnection({
        businessInfo: {
          ...emptyBusinessInfo(),
          details: {
            businessName: 'Old Crown Girton',
            description: 'Village pub and dining room.',
            languageCode: 'en',
            openingDate: null,
            businessStatus: 'OPEN',
            isServiceAreaBusiness: false,
            canReopen: null,
            source: 'google_business_profile',
            managedBy: 'google',
            lastSyncedAt: '2026-04-18T12:00:00.000Z',
          },
          addresses: [
            {
              id: 'addr-1',
              addressType: 'primary',
              formattedAddress: '1 High Street, Cambridge',
              addressLines: ['1 High Street'],
              locality: 'Cambridge',
              administrativeArea: null,
              postalCode: null,
              regionCode: 'GB',
              countryCode: 'GB',
              languageCode: 'en',
              sublocality: null,
              organization: null,
              sortingCode: null,
              recipients: [],
              latlng: null,
              latitude: null,
              longitude: null,
              isPrimary: true,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          phoneNumbers: [
            {
              id: 'phone-1',
              phoneKind: 'primary',
              phoneNumber: '+44 20 1234 5678',
              isPrimary: true,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          links: [
            {
              id: 'map-1',
              linkType: 'google_map',
              linkStatus: 'active',
              label: null,
              url: 'https://maps.google.com/?cid=abc',
              isPrimary: false,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
            {
              id: 'review-1',
              linkType: 'google_review',
              linkStatus: 'active',
              label: null,
              url: 'https://search.google.com/local/writereview?placeid=place-1',
              isPrimary: false,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
        },
      }),
    });

    expect(verification.status).toBe('verified');
    expect(verification.summary).toMatch(/currently match/i);
    expect(verification.fields.name.status).toBe('verified');
    expect(verification.fields.contactPhone.status).toBe('verified');
    expect(verification.fields.googleReviewUrl.googleManaged).toBe(true);
  });

  it('reports drift and pull/push capability for mismatched profile fields', () => {
    const verification = deriveProfileVerification({
      profile: buildProfile({
        name: 'Old Crown',
        contactPhone: '+44 20 0000 0000',
        googleMapUrl: null,
      }),
      connection: buildConnection({
        businessInfo: {
          ...emptyBusinessInfo(),
          phoneNumbers: [
            {
              id: 'phone-1',
              phoneKind: 'primary',
              phoneNumber: '+44 20 1234 5678',
              isPrimary: true,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
          links: [
            {
              id: 'map-1',
              linkType: 'google_map',
              linkStatus: 'active',
              label: null,
              url: 'https://maps.google.com/?cid=abc',
              isPrimary: false,
              lastSyncedAt: '2026-04-18T12:00:00.000Z',
            },
          ],
        },
      }),
    });

    expect(verification.status).toBe('drifted');
    expect(verification.canPull).toBe(true);
    expect(verification.canPush).toBe(true);
    expect(verification.recommendedDirection).toBe('pull_from_gbp');
    expect(verification.fields.name.status).toBe('drifted');
    expect(verification.fields.googleMapUrl.canPush).toBe(false);
    expect(verification.warnings).toContain(
      'Google Maps and Google Review links are Google-owned and can only be pulled into Nabatable.',
    );
  });
});
