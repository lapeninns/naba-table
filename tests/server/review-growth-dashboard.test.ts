import { describe, expect, it, vi } from 'vitest';

import {
  getReviewGrowthDashboard,
  ReviewGrowthTrackingUnavailableError,
} from '@/server/reviews/dashboard';

const summary = {
  from: '2026-08-06T12:00:00.000Z',
  to: '2026-09-05T12:00:00.000Z',
  completedVisits: 535,
  eligible: 470,
  suppressed: 65,
  sent: 450,
  reached: 388,
  clicked: 92,
  newGoogleReviews: 31,
  channels: {
    whatsapp: {
      sent: 424,
      delivered: 388,
      read: 299,
      opened: 0,
      clicked: 76,
      failed: 33,
      costMicrounits: 20_140_000,
      costCurrency: 'GBP',
    },
  },
};

describe('review growth dashboard service', () => {
  it('requests one tenant and a bounded date range', async () => {
    const rpc = vi.fn(async () => ({ data: summary, error: null }));

    const result = await getReviewGrowthDashboard(
      {
        restaurantId: '11111111-1111-4111-8111-111111111111',
        range: '30d',
        now: new Date('2026-09-05T12:00:00.000Z'),
      },
      { rpc } as never,
    );

    expect(result.newGoogleReviews).toBe(31);
    expect(rpc).toHaveBeenCalledWith('get_review_growth_dashboard_v1', {
      p_from: '2026-08-06T12:00:00.000Z',
      p_restaurant_id: '11111111-1111-4111-8111-111111111111',
      p_to: '2026-09-05T12:00:00.000Z',
    });
  });

  it('fails closed on malformed or unavailable aggregate data', async () => {
    const malformed = { rpc: vi.fn(async () => ({ data: { eligible: -1 }, error: null })) };

    await expect(
      getReviewGrowthDashboard({ restaurantId: 'restaurant-1', range: '7d' }, malformed as never),
    ).rejects.toBeInstanceOf(ReviewGrowthTrackingUnavailableError);
  });
});
