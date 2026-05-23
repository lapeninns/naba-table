import { describe, expect, it } from 'vitest';

import { buildCanonicalHourRows } from '@/server/google-business-profile/businessInfoCanonicalHours';

describe('google business profile business info canonical hours', () => {
  it('builds public, special, and service hour rows', () => {
    const rows = buildCanonicalHourRows({
      restaurantId: 'rest-1',
      sourceRecordId: 'locations/456',
      syncedAt: '2026-05-22T07:14:00.000Z',
      location: {
        regularHours: {
          periods: [
            {
              openDay: 'FRIDAY',
              closeDay: 'FRIDAY',
              openTime: '12:00',
              closeTime: '22:30',
            },
          ],
        },
        specialHours: {
          specialHourPeriods: [
            {
              startDate: { year: 2026, month: 12, day: 25 },
              endDate: { year: 2026, month: 12, day: 25 },
              closed: true,
            },
          ],
        },
        moreHours: [
          {
            hoursTypeId: 'KITCHEN',
            periods: [
              {
                openDay: 'SATURDAY',
                closeDay: 'SATURDAY',
                openTime: { hours: 12, minutes: 30 },
                closeTime: { hours: 21, minutes: 45 },
              },
              {
                openDay: 'SUNDAY',
                closeDay: 'SUNDAY',
                openTime: '13:00',
                closeTime: '20:00',
              },
            ],
          },
        ],
      } as never,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        restaurant_id: 'rest-1',
        hours_type: 'public',
        open_day: 5,
        close_day: 5,
        open_time: '12:00',
        close_time: '22:30',
        display_order: 0,
        source: 'gbp',
        managed_by: 'gbp',
        change_origin: 'google',
      }),
      expect.objectContaining({
        hours_type: 'special',
        start_date: '2026-12-25',
        end_date: '2026-12-25',
        open_time: null,
        close_time: null,
        is_closed: true,
      }),
      expect.objectContaining({
        hours_type: 'service',
        period_code: 'KITCHEN',
        period_label: 'Kitchen',
        open_day: 6,
        open_time: '12:30',
        close_time: '21:45',
        display_order: 0,
      }),
      expect.objectContaining({
        hours_type: 'service',
        period_code: 'KITCHEN',
        period_label: 'Kitchen',
        open_day: 0,
        open_time: '13:00',
        close_time: '20:00',
        display_order: 1,
      }),
    ]);
  });

  it('returns empty rows when the location has no hours payloads', () => {
    expect(
      buildCanonicalHourRows({
        restaurantId: 'rest-1',
        sourceRecordId: 'locations/456',
        syncedAt: '2026-05-22T07:14:00.000Z',
        location: {} as never,
      }),
    ).toEqual([]);
  });
});
