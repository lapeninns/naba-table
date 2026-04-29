import { describe, expect, it } from 'vitest';

import { updateRestaurantBusinessContext } from '@/server/restaurants/businessContext';

describe('restaurant business context writer', () => {
  it('stamps owner provenance and writes a profile change-log row for canonical attributes', async () => {
    const inserts: Array<{ table: string; rows: unknown[] }> = [];

    class Query {
      constructor(private readonly table: string) {}

      delete() {
        return this;
      }

      eq() {
        return this;
      }

      insert(rows: unknown[]) {
        inserts.push({ table: this.table, rows });
        return { error: null };
      }

      select() {
        return this;
      }

      order() {
        return this;
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

    await updateRestaurantBusinessContext(
      'rest-1',
      {
        serviceAreas: [
          {
            displayName: 'Cambridge',
            areaType: 'region',
            regionCode: 'GB',
            googlePlaceId: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
            googlePlaceResourceName: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
          },
        ],
        attributes: [
          {
            attributeKey: 'has_wifi',
            valueType: 'boolean',
            boolValue: true,
            rawValue: { boolValue: true },
            displayValue: { displayText: 'Wi-Fi: Yes' },
          },
        ],
      },
      client as Parameters<typeof updateRestaurantBusinessContext>[2],
      {
        changeOrigin: 'owner',
        changedByUserId: 'user-1',
        changedVia: 'ops_business_context_api',
        changeReason: 'Manual update from settings.',
      },
    );

    expect(inserts).toEqual(
      expect.arrayContaining([
        {
          table: 'restaurant_service_areas',
          rows: expect.arrayContaining([
            expect.objectContaining({
              display_name: 'Cambridge',
              google_place_id: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
              google_place_resource_name: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
              change_origin: 'owner',
            }),
          ]),
        },
        {
          table: 'restaurant_attributes',
          rows: expect.arrayContaining([
            expect.objectContaining({
              attribute_key: 'has_wifi',
              raw_value_json: { boolValue: true },
              display_value_json: { displayText: 'Wi-Fi: Yes' },
              change_origin: 'owner',
              changed_by_user_id: 'user-1',
              changed_via: 'ops_business_context_api',
              change_reason: 'Manual update from settings.',
            }),
          ]),
        },
        {
          table: 'restaurant_profile_change_log',
          rows: expect.arrayContaining([
            expect.objectContaining({
              restaurant_id: 'rest-1',
              entity_table: 'restaurant_attributes',
              field_path: '$',
              change_origin: 'owner',
              changed_by_user_id: 'user-1',
              changed_via: 'ops_business_context_api',
              change_reason: 'Manual update from settings.',
              status: 'applied',
            }),
          ]),
        },
      ]),
    );
  });
});
