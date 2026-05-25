import { describe, expect, it } from 'vitest';

import { buildFieldSyncStatus } from '@/server/google-business-profile/businessInfoFieldSyncStatus';
import { buildPayloadHash } from '@/server/google-business-profile/businessInfoNormalization';
import {
  combineFieldVerifications,
  mapGoogleBusinessProfileBusinessInfo,
  resolveFieldVerification,
} from '@/server/google-business-profile/businessInfoReadModel';

describe('google business profile business info read model', () => {
  it('marks field verification as drifted when provider and current values differ', () => {
    const row = {
      provider: 'gbp',
      sync_status: 'synced',
      verified_at: '2026-05-21T20:00:00.000Z',
      verified_by: 'gbp_sync',
      last_synced_at: '2026-05-21T20:00:00.000Z',
      last_checked_at: '2026-05-21T20:00:00.000Z',
      last_provider_value_json: 'Old Crown',
      value_hash: buildPayloadHash('Old Crown'),
    };

    expect(resolveFieldVerification(row as never, 'New Crown')).toEqual({
      provider: 'gbp',
      syncStatus: 'drifted',
      isVerified: false,
      verifiedAt: '2026-05-21T20:00:00.000Z',
      verifiedBy: 'gbp_sync',
      lastSyncedAt: '2026-05-21T20:00:00.000Z',
      lastCheckedAt: '2026-05-21T20:00:00.000Z',
    });
  });

  it('prefers drifted verification when combining field statuses', () => {
    expect(
      combineFieldVerifications([
        {
          provider: 'gbp',
          syncStatus: 'synced',
          isVerified: true,
          verifiedAt: null,
          verifiedBy: null,
          lastSyncedAt: null,
          lastCheckedAt: null,
        },
        {
          provider: 'gbp',
          syncStatus: 'drifted',
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          lastSyncedAt: null,
          lastCheckedAt: null,
        },
      ]),
    ).toMatchObject({ syncStatus: 'drifted', isVerified: false });
  });

  it('maps database rows and field sync statuses into the public read model', () => {
    const syncedAt = '2026-05-21T20:00:00.000Z';
    const detailsStatus = buildFieldSyncStatus({
      restaurantId: 'rest-1',
      entityTable: 'restaurant_business_details',
      entityKey: 'details',
      fieldKey: 'business_name',
      providerRecordId: 'locations/123',
      value: 'Old Crown',
      syncedAt,
    });
    const addressStatus = buildFieldSyncStatus({
      restaurantId: 'rest-1',
      entityTable: 'restaurant_addresses',
      entityKey: 'address:storefront:0',
      fieldKey: 'formatted_address',
      providerRecordId: 'locations/123',
      value: '1 High Street',
      syncedAt,
    });

    const readModel = mapGoogleBusinessProfileBusinessInfo({
      details: {
        business_name: 'Old Crown',
        description: 'Pub',
        language_code: 'en',
        opening_date: null,
        business_status: 'open',
        is_service_area_business: false,
        can_reopen: null,
        source: 'gbp',
        managed_by: 'gbp',
        last_synced_at: syncedAt,
      } as never,
      addresses: [
        {
          id: 'address-1',
          address_type: 'storefront',
          formatted_address: '1 High Street',
          address_lines: ['1 High Street'],
          locality: 'Cambridge',
          administrative_area: null,
          postal_code: 'CB1 1AA',
          region_code: 'GB',
          country_code: 'GB',
          language_code: 'en',
          sublocality: null,
          organization: null,
          sorting_code: null,
          recipients: [],
          latlng_json: { latitude: 52.2, longitude: 0.1 },
          latitude: null,
          longitude: null,
          is_primary: true,
          display_order: 0,
          last_synced_at: syncedAt,
        } as never,
      ],
      phoneNumbers: [],
      links: [],
      categories: [],
      serviceAreas: [],
      hours: [],
      attributes: [],
      serviceItems: [],
      fieldSyncStatuses: [detailsStatus, addressStatus] as never,
      coreOperatingHours: [],
      coreServicePeriods: [],
    });

    expect(readModel.details?.businessName).toBe('Old Crown');
    expect(readModel.details?.verification?.businessName).toMatchObject({
      syncStatus: 'synced',
      isVerified: true,
    });
    expect(readModel.addresses[0]).toMatchObject({
      formattedAddress: '1 High Street',
      latlng: { latitude: 52.2, longitude: 0.1 },
      verificationStatus: {
        syncStatus: 'synced',
        isVerified: true,
      },
    });
  });
});
