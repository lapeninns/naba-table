import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  businessInfoTestUtils,
  readGoogleBusinessProfileBusinessInfo,
} from '@/server/google-business-profile/business-info';

describe('google business profile business info mapping', () => {
  it('maps core location and attribute families into canonical rows', () => {
    const rows = businessInfoTestUtils.buildCanonicalRows({
      restaurantId: 'rest-1',
      syncedAt: '2026-04-18T12:00:00.000Z',
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        languageCode: 'en-GB',
        profile: {
          description: 'A family friendly pub and Nepalese restaurant.',
        },
        openInfo: {
          status: 'OPEN',
          canReopen: true,
          openingDate: {
            year: 2024,
            month: 8,
            day: 1,
          },
        },
        storefrontAddress: {
          addressLines: ['89 High Street'],
          locality: 'Girton',
          administrativeArea: 'Cambridgeshire',
          postalCode: 'CB3 0QD',
          regionCode: 'GB',
        },
        phoneNumbers: {
          primaryPhone: '01223 277217',
          additionalPhones: ['01223 277218'],
        },
        websiteUri: 'https://www.oldcrowngirton.com/',
        metadata: {
          placeId: 'place-1',
          mapsUri: 'https://maps.google.com/example',
          newReviewUri: 'https://g.page/r/example/review',
        },
        categories: {
          primaryCategory: {
            name: 'gcid:pub',
            displayName: 'Pub',
            moreHoursTypes: [
              {
                hoursTypeId: 'KITCHEN',
                displayName: 'Kitchen',
                localizedDisplayName: 'Kitchen',
              },
            ],
          },
          additionalCategories: [
            {
              name: 'gcid:nepalese_restaurant',
              displayName: 'Nepalese restaurant',
            },
          ],
        },
        regularHours: {
          periods: [
            {
              openDay: 'SUNDAY',
              closeDay: 'SUNDAY',
              openTime: '12:00',
              closeTime: '21:00',
            },
          ],
        },
        moreHours: [
          {
            hoursTypeId: 'KITCHEN',
            periods: [
              {
                openDay: 'FRIDAY',
                closeDay: 'FRIDAY',
                openTime: '17:00',
                closeTime: '22:00',
              },
            ],
          },
        ],
        serviceItems: [
          {
            structuredServiceItemId: 'private_dining',
            displayName: 'Private dining',
            description: 'Private dining room',
          },
        ],
      },
      attributes: {
        name: 'locations/456/attributes',
        attributes: [
          {
            attributeId: 'has_wheelchair_accessible_entrance',
            displayName: 'Wheelchair accessible entrance',
            groupDisplayName: 'Accessibility',
            valueType: 'BOOL',
            values: [{ boolValue: true }],
            displayStrings: {
              standaloneText: 'Has wheelchair accessible entrance',
              negativeText: 'No wheelchair accessible entrance',
            },
          },
          {
            attributeId: 'url_menu',
            displayName: 'Menu',
            valueType: 'URL',
            uriValues: [{ uri: 'https://www.oldcrowngirton.com/menu' }],
          },
        ],
      },
    });

    expect(rows.details?.description).toBe('A family friendly pub and Nepalese restaurant.');
    expect(rows.details?.business_name).toBe('Old Crown Girton');
    expect(rows.details?.language_code).toBe('en-GB');
    expect(rows.details?.can_reopen).toBe(true);
    expect(rows.details?.opening_date).toBe('2024-08-01');
    expect(rows.addresses[0]?.formatted_address).toContain('89 High Street');
    expect(rows.phoneNumbers).toHaveLength(2);
    expect(rows.links.some((link) => link.link_type === 'website')).toBe(true);
    expect(rows.links.some((link) => link.link_type === 'menu_or_services')).toBe(true);
    expect(rows.categories.map((category) => category.display_name)).toEqual([
      'Pub',
      'Nepalese restaurant',
    ]);
    expect(rows.categories[0]?.more_hours_types_json).toEqual([
      {
        hoursTypeId: 'KITCHEN',
        displayName: 'Kitchen',
        localizedDisplayName: 'Kitchen',
      },
    ]);
    expect(rows.hours[0]).toMatchObject({
      hours_type: 'public',
      open_day: 0,
      close_day: 0,
      open_time: '12:00',
      close_time: '21:00',
    });
    expect(rows.hours[1]).toMatchObject({
      hours_type: 'service',
      period_code: 'KITCHEN',
      period_label: 'Kitchen',
    });
    expect(rows.attributes[0]).toMatchObject({
      attribute_group: 'Accessibility',
      attribute_key: 'has_wheelchair_accessible_entrance',
      bool_value: true,
    });
    expect(rows.serviceItems[0]).toMatchObject({
      item_key: 'private_dining',
      display_name: 'Private dining',
    });
  });

  it('builds deterministic field sync status rows for canonical GBP values', () => {
    const rows = businessInfoTestUtils.buildCanonicalRows({
      restaurantId: 'rest-1',
      syncedAt: '2026-04-18T12:00:00.000Z',
      location: {
        name: 'locations/456',
        title: 'Old Crown Girton',
        languageCode: 'en-GB',
        profile: {
          description: 'A family friendly pub and Nepalese restaurant.',
        },
        openInfo: {
          status: 'OPEN',
          canReopen: true,
          openingDate: {
            year: 2024,
            month: 8,
            day: 1,
          },
        },
        storefrontAddress: {
          addressLines: ['89 High Street'],
          locality: 'Girton',
          administrativeArea: 'Cambridgeshire',
          postalCode: 'CB3 0QD',
          regionCode: 'GB',
        },
        phoneNumbers: {
          primaryPhone: '01223 277217',
        },
      },
      attributes: {
        name: 'locations/456/attributes',
        attributes: [
          {
            attributeId: 'has_wheelchair_accessible_entrance',
            displayName: 'Wheelchair accessible entrance',
            groupDisplayName: 'Accessibility',
            valueType: 'BOOL',
            values: [{ boolValue: true }],
          },
        ],
      },
    });

    const statuses = businessInfoTestUtils.buildFieldSyncStatuses({
      restaurantId: 'rest-1',
      rows,
      syncedAt: '2026-04-18T12:00:00.000Z',
    });

    expect(statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity_table: 'restaurant_business_details',
          entity_key: 'details',
          field_key: 'business_name',
          sync_status: 'synced',
          is_verified: true,
          last_provider_value_json: 'Old Crown Girton',
        }),
        expect.objectContaining({
          entity_table: 'restaurant_business_details',
          entity_key: 'details',
          field_key: 'description',
          sync_status: 'synced',
          is_verified: true,
          last_provider_value_json: 'A family friendly pub and Nepalese restaurant.',
        }),
        expect.objectContaining({
          entity_table: 'restaurant_phone_numbers',
          entity_key: 'phone:primary:0',
          field_key: 'phone_number',
          last_provider_value_json: '01223 277217',
        }),
        expect.objectContaining({
          entity_table: 'restaurant_attributes',
          entity_key: 'attribute:has_wheelchair_accessible_entrance',
          field_key: 'bool_value',
          last_provider_value_json: true,
        }),
      ]),
    );
  });

  it('prefers drifted verification when any tracked field no longer matches provider state', () => {
    const combined = businessInfoTestUtils.combineFieldVerifications([
      {
        provider: 'gbp',
        syncStatus: 'synced',
        isVerified: true,
        verifiedAt: '2026-04-18T12:00:00.000Z',
        verifiedBy: 'gbp_sync',
        lastSyncedAt: '2026-04-18T12:00:00.000Z',
        lastCheckedAt: '2026-04-18T12:00:00.000Z',
      },
      {
        provider: 'gbp',
        syncStatus: 'drifted',
        isVerified: false,
        verifiedAt: '2026-04-18T12:00:00.000Z',
        verifiedBy: 'gbp_sync',
        lastSyncedAt: '2026-04-18T12:00:00.000Z',
        lastCheckedAt: '2026-04-18T12:00:00.000Z',
      },
    ]);

    expect(combined?.syncStatus).toBe('drifted');
    expect(combined?.isVerified).toBe(false);
  });

  it('upserts GBP business details by provider ownership key', async () => {
    const calls: Array<{
      table: string;
      options: unknown;
    }> = [];
    const client = {
      from(table: string) {
        return {
          upsert(_payload: unknown, options: unknown) {
            calls.push({ table, options });
            return { error: null };
          },
        };
      },
    };

    await businessInfoTestUtils.upsertBusinessDetails(
      'rest-1',
      {
        restaurant_id: 'rest-1',
        business_name: 'Old Crown Girton',
        description: null,
        language_code: 'en-GB',
        opening_date: null,
        business_status: 'open',
        is_service_area_business: false,
        can_reopen: null,
        source: 'gbp',
        managed_by: 'gbp',
        source_record_id: 'locations/456',
        last_synced_at: '2026-04-25T12:00:00.000Z',
      },
      client as Parameters<typeof businessInfoTestUtils.upsertBusinessDetails>[2],
    );

    expect(calls).toEqual([
      {
        table: 'restaurant_business_details',
        options: { onConflict: 'restaurant_id,source,managed_by' },
      },
    ]);
  });

  it('reads only GBP-owned provider rows for business information snapshots', async () => {
    const eqCalls: Array<{ table: string; column: string; value: unknown }> = [];
    class Query {
      constructor(private readonly table: string) {}

      select() {
        return this;
      }

      eq(column: string, value: unknown) {
        eqCalls.push({ table: this.table, column, value });
        return this;
      }

      order() {
        return this;
      }

      maybeSingle() {
        return Promise.resolve({ data: null, error: null });
      }

      then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
        onfulfilled?:
          | ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>)
          | null,
        _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return Promise.resolve({ data: [], error: null }).then(onfulfilled);
      }
    }

    const client = {
      from(table: string) {
        return new Query(table);
      },
    };

    await readGoogleBusinessProfileBusinessInfo(
      'rest-1',
      client as Parameters<typeof readGoogleBusinessProfileBusinessInfo>[1],
    );

    for (const table of [
      'restaurant_business_details',
      'restaurant_addresses',
      'restaurant_phone_numbers',
      'restaurant_links',
      'restaurant_categories',
      'restaurant_service_areas',
      'restaurant_hours',
      'restaurant_attributes',
      'restaurant_service_items',
    ]) {
      expect(eqCalls).toEqual(
        expect.arrayContaining([
          { table, column: 'source', value: 'gbp' },
          { table, column: 'managed_by', value: 'gbp' },
        ]),
      );
    }
  });

  it('keeps provider and Nabatable primary rows separated in the foundation migration', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260425124700_align_gbp_provider_core_foundation.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('UNIQUE (restaurant_id, source, managed_by)');
    expect(migration).toContain(
      'ON public.restaurant_addresses (restaurant_id, source, managed_by)',
    );
    expect(migration).toContain(
      'UNIQUE (restaurant_id, phone_kind, phone_number, source, managed_by)',
    );
    expect(migration).toContain(
      'UNIQUE (restaurant_id, link_type, url, link_status, source, managed_by)',
    );
    expect(migration).toContain(
      'ON public.restaurant_categories (restaurant_id, source, managed_by)',
    );
  });

  it('skips provider verification persistence when the field sync status table is unavailable', async () => {
    const missingTableError = {
      code: 'PGRST205',
      message:
        "Could not find the table 'public.restaurant_field_sync_statuses' in the schema cache",
    };
    const operations: Array<{ type: string; table: string; rows?: unknown[] }> = [];

    const client = {
      from(table: string) {
        return {
          delete() {
            operations.push({ type: 'delete', table });
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return { error: missingTableError };
          },
          insert(rows: unknown[]) {
            operations.push({ type: 'insert', table, rows });
            return { error: missingTableError };
          },
        };
      },
    };

    await expect(
      businessInfoTestUtils.replaceProviderFieldSyncStatuses(
        'rest-1',
        [
          {
            restaurant_id: 'rest-1',
            provider: 'gbp',
            entity_table: 'restaurant_business_details',
            entity_key: 'details',
            field_key: 'description',
            sync_status: 'synced',
            is_verified: true,
            verified_at: '2026-04-18T12:00:00.000Z',
            verified_by: 'gbp_sync',
            last_synced_at: '2026-04-18T12:00:00.000Z',
            last_checked_at: '2026-04-18T12:00:00.000Z',
            last_provider_value_json: 'A family friendly pub.',
          },
        ],
        ['restaurant_business_details'],
        client as Parameters<typeof businessInfoTestUtils.replaceProviderFieldSyncStatuses>[3],
      ),
    ).resolves.toBeUndefined();

    expect(operations).toEqual([
      {
        type: 'delete',
        table: 'restaurant_field_sync_statuses',
      },
    ]);
  });
});
