import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const getRestaurantBySlugMock = vi.fn();
const getRestaurantScheduleMock = vi.fn();

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: (...args: unknown[]) => getRestaurantBySlugMock(...args),
}));

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: (...args: unknown[]) => getRestaurantScheduleMock(...args),
}));

describe('/api/restaurants/[slug]/schedule', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when slug is missing', async () => {
    const request = new NextRequest('http://localhost/api/restaurants//schedule');
    const response = await GET(request, {
      params: Promise.resolve({ slug: [] }),
    });

    expect(response.status).toBe(400);
  });

  it('validates date query parameter', async () => {
    const request = new NextRequest('http://localhost/api/restaurants/foo/schedule?date=invalid');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });

    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 404 when restaurant is missing', async () => {
    getRestaurantBySlugMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/restaurants/foo/schedule');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns schedule payload on success', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'rest-1' });
    getRestaurantScheduleMock.mockResolvedValue({
      restaurantId: 'rest-1',
      date: '2025-05-08',
      timezone: 'Europe/London',
      intervalMinutes: 15,
      defaultDurationMinutes: 90,
      window: { opensAt: '12:00', closesAt: '22:00' },
      isClosed: false,
      slots: [],
    });

    const request = new NextRequest('http://localhost/api/restaurants/foo/schedule?date=2025-05-08');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.restaurantId).toBe('rest-1');
    expect(getRestaurantScheduleMock).toHaveBeenCalledWith('rest-1', { date: '2025-05-08' });
  });
});
