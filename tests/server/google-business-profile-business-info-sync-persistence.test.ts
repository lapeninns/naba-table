import { describe, expect, it, vi } from 'vitest';

import { buildPayloadHash } from '@/server/google-business-profile/businessInfoNormalization';
import {
  buildProfileChangeLogRows,
  replaceGoogleBusinessProfileCanonicalBusinessInfo,
} from '@/server/google-business-profile/businessInfoSyncPersistence';

import type { CanonicalSyncRows } from '@/server/google-business-profile/businessInfoCanonicalRows';

function buildRows(overrides: Partial<CanonicalSyncRows> = {}): CanonicalSyncRows {
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

describe('google business profile business info sync persistence', () => {
  it('builds profile change-log rows only for synced populated tables', () => {
    const rows = buildRows({
      details: {
        restaurant_id: 'rest-1',
        business_name: 'Old Crown',
      } as never,
      addresses: [
        {
          restaurant_id: 'rest-1',
          formatted_address: '1 High Street',
        } as never,
      ],
      attributes: [
        {
          restaurant_id: 'rest-1',
          attribute_key: 'serves_beer',
        } as never,
      ],
      serviceItems: [
        {
          restaurant_id: 'rest-1',
          item_key: 'private_dining',
        } as never,
      ],
    });

    expect(
      buildProfileChangeLogRows({
        restaurantId: 'rest-1',
        externalProfileId: 'profile-1',
        syncedAt: '2026-05-22T07:51:00.000Z',
        rows,
        syncAttributes: true,
        syncServiceItems: false,
      }).map((row) => ({
        entity_table: row.entity_table,
        metadata: row.metadata,
        external_profile_id: row.external_profile_id,
      })),
    ).toEqual([
      {
        entity_table: 'restaurant_business_details',
        metadata: {
          syncWriter: 'syncGoogleBusinessProfileCanonicalBusinessInfo',
          rowCount: 1,
        },
        external_profile_id: 'profile-1',
      },
      {
        entity_table: 'restaurant_addresses',
        metadata: {
          syncWriter: 'syncGoogleBusinessProfileCanonicalBusinessInfo',
          rowCount: 1,
        },
        external_profile_id: 'profile-1',
      },
      {
        entity_table: 'restaurant_attributes',
        metadata: {
          syncWriter: 'syncGoogleBusinessProfileCanonicalBusinessInfo',
          rowCount: 1,
        },
        external_profile_id: 'profile-1',
      },
    ]);
  });

  it('builds the canonical replacement RPC payload without changing optional segment semantics', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const locationSnapshot = {
      name: 'locations/456',
      title: 'Old Crown',
    };
    const attributesSnapshot = {
      name: 'locations/456/attributes',
      attributes: [{ attributeId: 'serves_beer' }],
    };
    const rows = buildRows({
      details: {
        restaurant_id: 'rest-1',
        business_name: 'Old Crown',
      } as never,
      serviceItems: [
        {
          restaurant_id: 'rest-1',
          item_key: 'private_dining',
        } as never,
      ],
    });

    await replaceGoogleBusinessProfileCanonicalBusinessInfo({
      restaurantId: 'rest-1',
      externalProfileId: 'profile-1',
      locationSnapshot,
      locationSourceRevision: 'locations/456',
      attributesSnapshot,
      attributesSourceRevision: 'locations/456/attributes',
      rows,
      fieldSyncStatuses: [{ entity_table: 'restaurant_business_details' } as never],
      fieldSyncEntityTables: ['restaurant_business_details'],
      profileChangeLogRows: [{ entity_table: 'restaurant_business_details' } as never],
      syncAttributes: false,
      syncServiceItems: true,
      client: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith('replace_gbp_canonical_business_info', {
      p_restaurant_id: 'rest-1',
      p_external_profile_id: 'profile-1',
      p_location_snapshot: locationSnapshot,
      p_location_source_revision: 'locations/456',
      p_location_payload_hash: buildPayloadHash(locationSnapshot),
      p_attributes_snapshot: null,
      p_attributes_source_revision: null,
      p_attributes_payload_hash: null,
      p_business_details: rows.details,
      p_addresses: [],
      p_phone_numbers: [],
      p_links: [],
      p_categories: [],
      p_service_areas: [],
      p_hours: [],
      p_attributes: null,
      p_service_items: rows.serviceItems,
      p_field_sync_statuses: [{ entity_table: 'restaurant_business_details' }],
      p_field_sync_entity_tables: ['restaurant_business_details'],
      p_profile_change_log_rows: [{ entity_table: 'restaurant_business_details' }],
    });
  });
});
