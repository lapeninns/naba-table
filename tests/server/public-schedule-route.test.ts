import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getGuestBookingScheduleMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/restaurants/guestBookingSchedule', () => ({
  getGuestBookingSchedule: getGuestBookingScheduleMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

import { GET } from '@/src/app/api/restaurants/[slug]/schedule/route';

describe('public restaurant schedule route', () => {
  beforeEach(() => {
    getRestaurantBySlugMock.mockReset();
    getRestaurantScheduleMock.mockReset();
    getGuestBookingScheduleMock.mockReset();
    requireApiRateLimitMock.mockReset().mockResolvedValue(null);
  });

  it('rate limits before public schedule lookups', async () => {
    requireApiRateLimitMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many schedule requests' }), { status: 429 }),
    );

    const response = await GET(
      new NextRequest('https://www.nabatable.com/api/restaurants/the-bell/schedule'),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'restaurant-schedule:public',
      }),
    );
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('rejects invalid and out-of-horizon schedule dates before lookup work', async () => {
    const invalid = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/schedule?date=2026-02-31',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );
    const farFuture = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/schedule?date=2099-12-31',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(invalid.status).toBe(400);
    expect(farFuture.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
    expect(getRestaurantScheduleMock).not.toHaveBeenCalled();
  });

  it('rejects party sizes outside the online booking limit', async () => {
    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/schedule?date=2026-07-01&party=13',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
    expect(getRestaurantScheduleMock).not.toHaveBeenCalled();
  });

  it('applies a tenant schedule rate limit after resolving the public slug', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'restaurant-1' });
    requireApiRateLimitMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Too many schedule requests' }), { status: 429 }),
      );

    const response = await GET(
      new NextRequest('https://www.nabatable.com/api/restaurants/the-bell/schedule'),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(429);
    expect(requireApiRateLimitMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        scope: 'restaurant-schedule:tenant',
        tenantId: 'restaurant-1',
      }),
    );
    expect(getRestaurantScheduleMock).not.toHaveBeenCalled();
  });

  it('returns a party-aware guest schedule when party is supplied', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'restaurant-1' });
    getGuestBookingScheduleMock.mockResolvedValue({ slots: [], evaluatedPartySize: 4 });

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/schedule?date=2026-07-01&party=4',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(200);
    expect(getGuestBookingScheduleMock).toHaveBeenCalledWith('restaurant-1', {
      date: '2026-07-01',
      partySize: 4,
    });
    expect(getRestaurantScheduleMock).not.toHaveBeenCalled();
  });

  it('preserves the raw schedule contract when party is omitted', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'restaurant-1' });
    getRestaurantScheduleMock.mockResolvedValue({ slots: [] });

    const response = await GET(
      new NextRequest(
        'https://www.nabatable.com/api/restaurants/the-bell/schedule?date=2026-07-01',
      ),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(200);
    expect(getRestaurantScheduleMock).toHaveBeenCalledWith('restaurant-1', {
      date: '2026-07-01',
    });
    expect(getGuestBookingScheduleMock).not.toHaveBeenCalled();
  });
});
