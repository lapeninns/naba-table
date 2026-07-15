import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, fromMock, queryResults } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  queryResults: [] as Array<{ data: unknown; error: null }>,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

import { buildDailySummaryPreview, listRestaurantDailySummaryTargets } from '../src/supabase';

const env = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
};

function queryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(queryResults.shift() ?? { data: null, error: null }).then(resolve),
  };
  return builder;
}

describe('SMS summary query budget', () => {
  beforeEach(() => {
    queryResults.length = 0;
    fromMock.mockReset().mockImplementation(() => queryBuilder());
    createClientMock.mockReset().mockReturnValue({ from: fromMock });
  });

  it('measures one Supabase call for target listing regardless of row count @contract', async () => {
    queryResults.push({
      data: Array.from({ length: 25 }, (_, index) => ({
        id: `restaurant-${index}`,
        timezone: 'Europe/London',
        is_active: true,
        manager_daily_summary_enabled: true,
        manager_notification_phone: '+447700900000',
        manager_whatsapp_enabled: false,
        manager_whatsapp_consent_phone: null,
      })),
      error: null,
    });

    await expect(listRestaurantDailySummaryTargets(env)).resolves.toHaveLength(25);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('restaurants');
  });

  it('measures two Supabase calls for a preview regardless of booking count @contract', async () => {
    queryResults.push(
      { data: { name: 'The Test Venue' }, error: null },
      {
        data: Array.from({ length: 40 }, () => ({
          status: 'confirmed',
          booking_type: 'dinner',
          party_size: 2,
        })),
        error: null,
      },
    );

    await buildDailySummaryPreview(env, {
      restaurantId: 'restaurant-1',
      localDate: '2026-07-15',
      timezone: 'Europe/London',
    });

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(['restaurants', 'bookings']);
  });
});
