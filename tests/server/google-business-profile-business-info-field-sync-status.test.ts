import { describe, expect, it } from 'vitest';

import {
  buildFieldStatusLookupKey,
  buildFieldSyncStatus,
  buildFieldSyncStatuses,
  getAddressEntityKey,
  getDetailsEntityKey,
  getServiceItemEntityKey,
} from '@/server/google-business-profile/businessInfoFieldSyncStatus';
import { buildPayloadHash } from '@/server/google-business-profile/businessInfoNormalization';

import type { CanonicalSyncRowsForFieldStatuses } from '@/server/google-business-profile/businessInfoFieldSyncStatus';

function buildRows(
  overrides: Partial<CanonicalSyncRowsForFieldStatuses> = {},
): CanonicalSyncRowsForFieldStatuses {
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
    ...overrides,
  };
}

describe('google business profile business info field sync statuses', () => {
  it('builds stable entity and lookup keys', () => {
    expect(getDetailsEntityKey()).toBe('details');
    expect(getAddressEntityKey({ addressType: 'storefront', displayOrder: 2 })).toBe(
      'address:storefront:2',
    );
    expect(getServiceItemEntityKey({ itemKey: 'delivery' })).toBe('service_item:delivery');
    expect(
      buildFieldStatusLookupKey('restaurant_addresses', 'address:storefront:2', 'postal_code'),
    ).toBe('restaurant_addresses::address:storefront:2::postal_code');
  });

  it('builds a verified synced field status with provider and canonical value hashes', () => {
    const status = buildFieldSyncStatus({
      restaurantId: 'rest-1',
      entityTable: 'restaurant_business_details',
      entityKey: 'details',
      fieldKey: 'business_name',
      providerRecordId: 'locations/123',
      value: 'Old Crown',
      syncedAt: '2026-05-21T20:00:00.000Z',
    });

    expect(status).toMatchObject({
      restaurant_id: 'rest-1',
      provider: 'gbp',
      entity_table: 'restaurant_business_details',
      entity_key: 'details',
      field_key: 'business_name',
      provider_record_id: 'locations/123',
      sync_status: 'synced',
      is_verified: true,
      verified_by: 'gbp_sync',
      last_provider_value_json: 'Old Crown',
      last_canonical_value_json: 'Old Crown',
      value_hash: buildPayloadHash('Old Crown'),
      last_synced_at: '2026-05-21T20:00:00.000Z',
      last_checked_at: '2026-05-21T20:00:00.000Z',
    });
  });

  it('creates detail and address field statuses from canonical rows', () => {
    const statuses = buildFieldSyncStatuses({
      restaurantId: 'rest-1',
      syncedAt: '2026-05-21T20:00:00.000Z',
      rows: buildRows({
        details: {
          restaurant_id: 'rest-1',
          business_name: 'Old Crown',
          description: 'Pub',
          language_code: 'en',
          opening_date: '2020-01-02',
          business_status: 'open',
          is_service_area_business: false,
          can_reopen: null,
          source_record_id: 'locations/123',
        },
        addresses: [
          {
            restaurant_id: 'rest-1',
            address_type: 'storefront',
            display_order: 1,
            formatted_address: '1 High Street',
            address_lines: ['1 High Street'],
            locality: 'London',
            administrative_area: 'Greater London',
            postal_code: 'SW1A 1AA',
            region_code: 'GB',
            country_code: 'GB',
            latitude: 51.5,
            longitude: -0.1,
            source_record_id: 'locations/123',
          },
        ],
      }),
    });

    expect(statuses).toHaveLength(16);
    expect(statuses.map((status) => `${status.entity_key}:${status.field_key}`)).toEqual(
      expect.arrayContaining([
        'details:business_name',
        'details:can_reopen',
        'address:storefront:1:formatted_address',
        'address:storefront:1:longitude',
      ]),
    );
  });

  it('can omit service item statuses when the optional Google section was unavailable', () => {
    const rows = buildRows({
      serviceItems: [
        {
          restaurant_id: 'rest-1',
          item_key: 'delivery',
          item_type: 'service',
          display_name: 'Delivery',
          description: 'Local delivery',
          payload_json: { id: 'delivery' },
          source_record_id: 'locations/123',
        },
      ],
    });

    expect(
      buildFieldSyncStatuses({
        restaurantId: 'rest-1',
        syncedAt: '2026-05-21T20:00:00.000Z',
        rows,
        syncServiceItems: false,
      }),
    ).toEqual([]);
    expect(
      buildFieldSyncStatuses({
        restaurantId: 'rest-1',
        syncedAt: '2026-05-21T20:00:00.000Z',
        rows,
      }),
    ).toHaveLength(4);
  });
});
