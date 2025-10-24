import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const getRestaurantBySlugMock = vi.fn();
const getClosedDaysForRangeMock = vi.fn();

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: (...args: unknown[]) => getRestaurantBySlugMock(...args),
}));

vi.mock('@/server/restaurants/closedDays', () => ({
  getClosedDaysForRange: (...args: unknown[]) => getClosedDaysForRangeMock(...args),
}));

describe('/api/restaurants/[slug]/closed-days', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when slug is missing', async () => {
    const request = new NextRequest('http://localhost/api/restaurants//closed-days');
    const response = await GET(request, {
      params: Promise.resolve({ slug: [] }),
    });
    expect(response.status).toBe(400);
  });

  it('validates date query parameters', async () => {
    const request = new NextRequest('http://localhost/api/restaurants/foo/closed-days?start=bad&end=also-bad');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });
    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 404 when restaurant is missing', async () => {
    getRestaurantBySlugMock.mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/restaurants/foo/closed-days?start=2025-05-01&end=2025-05-31');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });
    expect(response.status).toBe(404);
  });

  it('returns closed days payload on success and sets cache headers', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'rest-1' });
    getClosedDaysForRangeMock.mockResolvedValue({
      timezone: 'Europe/London',
      closed: ['2025-05-01', '2025-05-02'],
    });

    const request = new NextRequest('http://localhost/api/restaurants/foo/closed-days?start=2025-05-01&end=2025-05-31');
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'foo' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.timezone).toBe('Europe/London');
    expect(json.closed).toEqual(['2025-05-01', '2025-05-02']);
    expect(getClosedDaysForRangeMock).toHaveBeenCalledWith('rest-1', '2025-05-01', '2025-05-31');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=1800');
  });
});

