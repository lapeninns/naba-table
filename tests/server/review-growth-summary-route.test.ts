import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireSessionMock = vi.hoisted(() => vi.fn());
const listMembershipsMock = vi.hoisted(() => vi.fn());
const requireRestaurantMemberMock = vi.hoisted(() => vi.fn());
const getReviewGrowthDashboardMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', async () => {
  const actual = await vi.importActual('@/server/auth/guards');
  return {
    ...actual,
    requireSession: requireSessionMock,
    listUserRestaurantMemberships: listMembershipsMock,
    requireRestaurantMember: requireRestaurantMemberMock,
  };
});

vi.mock('@/server/reviews/dashboard', async () => {
  const actual = await vi.importActual('@/server/reviews/dashboard');
  return { ...actual, getReviewGrowthDashboard: getReviewGrowthDashboardMock };
});

import { GET } from '@/src/app/api/ops/reviews/summary/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

describe('review growth summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ supabase: {}, user: { id: 'user-1' } });
    listMembershipsMock.mockResolvedValue([{ restaurant_id: RESTAURANT_ID }]);
    requireRestaurantMemberMock.mockResolvedValue({});
    getReviewGrowthDashboardMock.mockResolvedValue({
      from: '2026-08-06T12:00:00.000Z',
      to: '2026-09-05T12:00:00.000Z',
      completedVisits: 10,
      eligible: 8,
      suppressed: 2,
      sent: 8,
      reached: 7,
      clicked: 3,
      newGoogleReviews: 2,
      channels: {},
    });
  });

  it('authorizes the selected tenant before reading its aggregate', async () => {
    const response = await GET(
      new Request(
        `https://app.nabatable.com/api/ops/reviews/summary?restaurantId=${RESTAURANT_ID}&range=30d`,
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(requireRestaurantMemberMock).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      supabase: {},
      userId: 'user-1',
    });
    expect(getReviewGrowthDashboardMock).toHaveBeenCalledWith({
      range: '30d',
      restaurantId: RESTAURANT_ID,
    });
  });

  it('rejects malformed restaurant identities before authentication or data access', async () => {
    const response = await GET(
      new Request(
        'https://app.nabatable.com/api/ops/reviews/summary?restaurantId=wrong&range=30d',
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(requireSessionMock).not.toHaveBeenCalled();
    expect(getReviewGrowthDashboardMock).not.toHaveBeenCalled();
  });
});
