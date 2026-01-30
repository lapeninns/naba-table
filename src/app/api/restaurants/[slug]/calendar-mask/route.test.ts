import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const getRestaurantBySlugMock = vi.fn();
const getRestaurantCalendarMaskMock = vi.fn();

vi.mock('@/server/restaurants', () => ({
  getRestaurantBySlug: (...args: unknown[]) => getRestaurantBySlugMock(...args),
}));

vi.mock('@/server/restaurants/calendarMask', () => ({
  getRestaurantCalendarMask: (...args: unknown[]) => getRestaurantCalendarMaskMock(...args),
}));

describe('/api/restaurants/[slug]/calendar-mask', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when slug is missing', async () => {
    const request = new NextRequest('http://localhost/api/restaurants//calendar-mask');
    const response = await GET(request, { params: { slug: [] } });

    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('validates query parameters', async () => {
    const request = new NextRequest('http://localhost/api/restaurants/foo/calendar-mask?from=invalid');
    const response = await GET(request, { params: { slug: 'foo' } });

    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('rejects ranges where `to` precedes `from`', async () => {
    const request = new NextRequest(
      'http://localhost/api/restaurants/foo/calendar-mask?from=2025-05-10&to=2025-05-01',
    );
    const response = await GET(request, { params: { slug: 'foo' } });

    expect(response.status).toBe(400);
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the restaurant is not found', async () => {
    getRestaurantBySlugMock.mockResolvedValue(null);

    const request = new NextRequest(
      'http://localhost/api/restaurants/foo/calendar-mask?from=2025-05-01&to=2025-05-31',
    );
    const response = await GET(request, { params: { slug: 'foo' } });

    expect(response.status).toBe(404);
    expect(getRestaurantCalendarMaskMock).not.toHaveBeenCalled();
  });

  it('returns the calendar mask payload on success', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'rest-1', timezone: 'Europe/London' });
    getRestaurantCalendarMaskMock.mockResolvedValue({
      timezone: 'Europe/London',
      from: '2025-05-01',
      to: '2025-05-31',
      closedDaysOfWeek: [0, 6],
      closedDates: ['2025-05-27'],
    });

    const request = new NextRequest(
      'http://localhost/api/restaurants/foo/calendar-mask?from=2025-05-01&to=2025-05-31',
    );
    const response = await GET(request, { params: { slug: 'foo' } });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('max-age=60');
    const payload = await response.json();
    expect(payload.closedDaysOfWeek).toEqual([0, 6]);
    expect(getRestaurantCalendarMaskMock).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      timezone: 'Europe/London',
      from: '2025-05-01',
      to: '2025-05-31',
    });
  });

  it('handles downstream errors gracefully', async () => {
    getRestaurantBySlugMock.mockResolvedValue({ id: 'rest-1', timezone: 'UTC' });
    getRestaurantCalendarMaskMock.mockRejectedValue(new Error('boom'));

    const request = new NextRequest(
      'http://localhost/api/restaurants/foo/calendar-mask?from=2025-05-01&to=2025-05-31',
    );
    const response = await GET(request, { params: { slug: 'foo' } });

    expect(response.status).toBe(500);
  });
});
