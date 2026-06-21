import { describe, expect, it } from 'vitest';

import { buildFieldSyncStatus } from '@/server/google-business-profile/businessInfoFieldSyncStatus';
import {
  mapAttribute,
  mapCategory,
} from '@/server/google-business-profile/businessInfoReadModelMappers';
import { buildFieldSyncStatusLookup } from '@/server/google-business-profile/businessInfoReadModelVerification';

describe('google business profile business info read model mappers', () => {
  it('normalizes category more-hours metadata and preserves verification status', () => {
    const syncedAt = '2026-05-22T07:05:00.000Z';
    const lookup = buildFieldSyncStatusLookup([
      buildFieldSyncStatus({
        restaurantId: 'rest-1',
        entityTable: 'restaurant_categories',
        entityKey: 'category:0',
        fieldKey: 'display_name',
        providerRecordId: 'locations/123/categories/0',
        value: 'Restaurant',
        syncedAt,
      }),
    ] as never);

    const category = mapCategory(
      {
        id: 'category-1',
        display_name: 'Restaurant',
        category_code: 'gcid:restaurant',
        more_hours_types_json: [
          {
            hoursTypeId: 'BREAKFAST',
            displayName: ' Breakfast ',
            localizedDisplayName: ' Breakfast hours ',
          },
          { hoursTypeId: '   ', displayName: '', localizedDisplayName: null },
          null,
        ],
        is_primary: true,
        display_order: 0,
        last_synced_at: syncedAt,
      } as never,
      lookup,
    );

    expect(category).toMatchObject({
      displayName: 'Restaurant',
      categoryCode: 'gcid:restaurant',
      moreHoursTypes: [
        {
          hoursTypeId: 'BREAKFAST',
          displayName: 'Breakfast',
          localizedDisplayName: 'Breakfast hours',
        },
      ],
      verificationStatus: {
        syncStatus: 'synced',
        isVerified: true,
      },
    });
  });

  it('normalizes attribute arrays, value metadata, records, and verification drift', () => {
    const syncedAt = '2026-05-22T07:05:00.000Z';
    const lookup = buildFieldSyncStatusLookup([
      buildFieldSyncStatus({
        restaurantId: 'rest-1',
        entityTable: 'restaurant_attributes',
        entityKey: 'attribute:has_wheelchair_accessible_entrance',
        fieldKey: 'display_name',
        providerRecordId: 'locations/123/attributes/has_wheelchair_accessible_entrance',
        value: 'Wheelchair accessible entrance',
        syncedAt,
      }),
    ] as never);

    const attribute = mapAttribute(
      {
        id: 'attribute-1',
        attribute_group: 'accessibility',
        attribute_key: 'has_wheelchair_accessible_entrance',
        attribute_name: 'has_wheelchair_accessible_entrance',
        attribute_id: 'attributes/has_wheelchair_accessible_entrance',
        display_name: 'Accessible entrance',
        display_text: 'Accessible entrance available',
        display_text_standalone: null,
        display_text_negative: null,
        value_type: 'BOOL',
        bool_value: true,
        text_value: null,
        uri_value: null,
        uri_values: ['https://example.com', 123],
        enum_values: ['yes', null, 'step_free'],
        unset_enum_values: ['no', false],
        raw_value_json: { boolValue: true },
        raw_enum_values_json: { enumValues: ['yes'] },
        display_value_json: { label: 'Yes' },
        value_metadata_json: [
          { value: true, displayName: ' Yes ' },
          { value: null, displayName: '' },
          'bad',
        ],
        last_synced_at: syncedAt,
      } as never,
      lookup,
    );

    expect(attribute).toMatchObject({
      uriValues: ['https://example.com'],
      enumValues: ['yes', 'step_free'],
      unsetEnumValues: ['no'],
      rawValue: { boolValue: true },
      rawEnumValues: { enumValues: ['yes'] },
      displayValue: { label: 'Yes' },
      valueMetadata: [{ value: true, displayName: 'Yes' }],
      verificationStatus: {
        syncStatus: 'drifted',
        isVerified: false,
      },
    });
  });
});
