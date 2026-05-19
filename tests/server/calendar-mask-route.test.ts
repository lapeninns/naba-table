import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const getRestaurantCalendarMaskMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

vi.mock('@/server/restaurants/calendarMask', () => ({
  getRestaurantCalendarMask: getRestaurantCalendarMaskMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { GET } from '@/src/app/api/restaurants/[slug]/calendar-mask/route';

describe('public calendar-mask route', () => {
  it('rejects unbounded date ranges before restaurant lookup', async () => {
    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/calendar-mask?from=2026-07-01&to=2026-10-01',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('62 days or less');
    expect(requireApiRateLimitMock).not.toHaveBeenCalled();
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
    expect(getRestaurantCalendarMaskMock).not.toHaveBeenCalled();
  });
});
