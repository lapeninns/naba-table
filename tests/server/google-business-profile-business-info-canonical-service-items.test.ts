import { describe, expect, it } from 'vitest';

import { buildCanonicalServiceItemRows } from '@/server/google-business-profile/businessInfoCanonicalServiceItems';

describe('google business profile business info canonical service items', () => {
  it('builds canonical service item rows from structured items', () => {
    const rows = buildCanonicalServiceItemRows({
      restaurantId: 'rest-1',
      syncedAt: '2026-05-22T07:24:00.000Z',
      location: {
        serviceItems: [
          {
            structuredServiceItemId: 'private_dining',
            serviceType: 'event',
            displayName: 'Private dining',
            description: 'Private room bookings',
          },
          {
            itemId: ' buffet ',
            type: 'catering',
            title: 'Buffet',
            summary: 'Buffet service',
          },
        ],
      } as never,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        restaurant_id: 'rest-1',
        item_key: 'private_dining',
        item_type: 'event',
        display_name: 'Private dining',
        description: 'Private room bookings',
        display_order: 0,
        source_record_id: 'private_dining',
        source: 'gbp',
        managed_by: 'gbp',
        change_origin: 'google',
      }),
      expect.objectContaining({
        item_key: 'buffet',
        item_type: 'catering',
        display_name: 'Buffet',
        description: 'Buffet service',
        payload_json: expect.objectContaining({
          itemId: ' buffet ',
          title: 'Buffet',
        }),
        display_order: 1,
      }),
    ]);
  });

  it('uses fallback keys for sparse service item payloads', () => {
    const rows = buildCanonicalServiceItemRows({
      restaurantId: 'rest-1',
      syncedAt: '2026-05-22T07:24:00.000Z',
      location: {
        serviceItems: [{ title: 'Fallback only' }],
      } as never,
    });

    expect(rows[0]).toMatchObject({
      item_key: expect.stringMatching(/^service_item_/),
      display_name: 'Fallback only',
      display_order: 0,
    });
  });

  it('returns empty rows when service items are unavailable', () => {
    expect(
      buildCanonicalServiceItemRows({
        restaurantId: 'rest-1',
        syncedAt: '2026-05-22T07:24:00.000Z',
        location: {} as never,
      }),
    ).toEqual([]);
  });
});
