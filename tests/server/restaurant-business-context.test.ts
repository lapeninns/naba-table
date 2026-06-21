import { describe, expect, it, vi } from 'vitest';

import { updateRestaurantBusinessContext } from '@/server/restaurants/businessContext';

describe('restaurant business context writer', () => {
  it('uses the atomic replacement RPC and writes a profile change-log row for canonical attributes', async () => {
    const inserts: Array<{ table: string; rows: unknown[] }> = [];
    const rpc = vi.fn().mockResolvedValue({ error: null });

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
      rpc,
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

    expect(rpc).toHaveBeenCalledWith('replace_restaurant_business_context_core', {
      p_restaurant_id: 'rest-1',
      p_business_details: null,
      p_links: null,
      p_categories: null,
      p_service_areas: [
        expect.objectContaining({
          display_name: 'Cambridge',
          google_place_id: 'ChIJLQEq84ld2EcRIT1eo-Ego2M',
          google_place_resource_name: 'places/ChIJLQEq84ld2EcRIT1eo-Ego2M',
        }),
      ],
      p_attributes: [
        expect.objectContaining({
          attribute_key: 'has_wifi',
          value_type: 'boolean',
          raw_value_json: { boolValue: true },
          display_value_json: { displayText: 'Wi-Fi: Yes' },
        }),
      ],
      p_service_items: null,
    });

    expect(inserts.some((entry) => entry.table === 'restaurant_service_areas')).toBe(false);
    expect(inserts.some((entry) => entry.table === 'restaurant_attributes')).toBe(false);
    const changeLogInsert = inserts.find(
      (entry) => entry.table === 'restaurant_profile_change_log',
    );

    expect(changeLogInsert?.rows).toEqual(
      expect.arrayContaining([
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
    );
  });

  it('rejects malformed persisted row ids before replacement', async () => {
    const rpc = vi.fn();
    const client = {
      rpc,
      from: vi.fn(),
    };

    await expect(
      updateRestaurantBusinessContext(
        'rest-1',
        {
          serviceAreas: [
            {
              id: 'local-service-area',
              displayName: 'Cambridge',
              areaType: 'region',
            },
          ],
        },
        client as Parameters<typeof updateRestaurantBusinessContext>[2],
      ),
    ).rejects.toThrow(/Service area id must be a valid UUID/);

    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects invalid service area and attribute enums before replacement', async () => {
    const rpc = vi.fn();
    const client = {
      rpc,
      from: vi.fn(),
    };

    await expect(
      updateRestaurantBusinessContext(
        'rest-1',
        {
          serviceAreas: [
            {
              displayName: 'Cambridge',
              areaType: 'county',
            },
          ],
        },
        client as Parameters<typeof updateRestaurantBusinessContext>[2],
      ),
    ).rejects.toThrow(/Service area type must be one of/);

    await expect(
      updateRestaurantBusinessContext(
        'rest-1',
        {
          attributes: [
            {
              attributeKey: 'has_wifi',
              valueType: 'unknown',
            },
          ],
        },
        client as Parameters<typeof updateRestaurantBusinessContext>[2],
      ),
    ).rejects.toThrow(/value type must be one of/);

    expect(rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });
});
