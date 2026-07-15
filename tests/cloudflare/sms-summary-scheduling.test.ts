import { describe, expect, it } from 'vitest';

import {
  resolveDueDispatch,
  selectDueDispatches,
} from '@/cloudflare/sms-summary-gateway/src/scheduling';
import { DAILY_SUMMARY_QUERY_BUDGET } from '@/cloudflare/sms-summary-gateway/src/supabase';

describe('sms summary scheduling', () => {
  it('caps summary data access independently of booking count (N+1 guard)', () => {
    expect(DAILY_SUMMARY_QUERY_BUDGET).toEqual({ listTargets: 1, loadPreview: 2 });
  });

  it('detects the local 10:00 window in summer and winter time @worker', () => {
    expect(
      resolveDueDispatch({
        now: '2026-06-15T09:05:00.000Z',
        timezone: 'Europe/London',
      }),
    ).toMatchObject({ dueNow: true, localDate: '2026-06-15' });

    expect(
      resolveDueDispatch({
        now: '2026-12-15T10:05:00.000Z',
        timezone: 'Europe/London',
      }),
    ).toMatchObject({ dueNow: true, localDate: '2026-12-15' });
  });

  it('returns only enabled restaurants that are due in the current window @worker', () => {
    const due = selectDueDispatches(
      [
        {
          restaurantId: 'restaurant-1',
          timezone: 'Europe/London',
          enabled: true,
          recipient: '+447700900000',
        },
        {
          restaurantId: 'restaurant-2',
          timezone: 'Europe/London',
          enabled: false,
          recipient: '+447700900001',
        },
        {
          restaurantId: 'restaurant-3',
          timezone: 'America/New_York',
          enabled: true,
          recipient: '+15551234567',
        },
      ],
      '2026-06-15T09:05:00.000Z',
    );

    expect(due).toHaveLength(1);
    expect(due[0]?.restaurantId).toBe('restaurant-1');
    expect(due[0]?.localDate).toBe('2026-06-15');
  });
});
