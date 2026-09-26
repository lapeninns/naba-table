import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRestaurantBySlugMock = vi.hoisted(() => vi.fn());
const listRestaurantsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/getRestaurantBySlug', () => ({
  getRestaurantBySlug: getRestaurantBySlugMock,
}));

vi.mock('@/server/restaurants/listRestaurants', () => ({
  listRestaurants: listRestaurantsMock,
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
}));

import { GET as getRestaurant } from '@/src/app/api/restaurants/[slug]/route';
import { GET as listRestaurants } from '@/src/app/api/restaurants/route';

describe('GET /api/restaurants/[slug]', () => {
  beforeEach(() => {
    getRestaurantBySlugMock.mockReset();
  });

  it('returns MISSING_SLUG when no slug is supplied', async () => {
    const response = await getRestaurant(
      new NextRequest('https://www.nabatable.com/api/restaurants/'),
      { params: Promise.resolve({ slug: [] }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing restaurant slug.',
      code: 'MISSING_SLUG',
      message: 'Missing restaurant slug.',
    });
    expect(getRestaurantBySlugMock).not.toHaveBeenCalled();
  });

  it('treats an empty slug as missing', async () => {
    const response = await getRestaurant(
      new NextRequest('https://www.nabatable.com/api/restaurants/'),
      { params: Promise.resolve({ slug: '' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_SLUG' });
  });

  it('returns RESTAURANT_NOT_FOUND for an unknown slug', async () => {
    getRestaurantBySlugMock.mockResolvedValue(null);

    const response = await getRestaurant(
      new NextRequest('https://www.nabatable.com/api/restaurants/missing'),
      { params: Promise.resolve({ slug: 'missing' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Restaurant not found.',
      code: 'RESTAURANT_NOT_FOUND',
      message: 'Restaurant not found.',
    });
  });

  it('returns a generic 500 without raw failure text when the lookup throws', async () => {
    getRestaurantBySlugMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL permission denied for table restaurants'),
    );

    const response = await getRestaurant(
      new NextRequest('https://www.nabatable.com/api/restaurants/the-bell'),
      { params: Promise.resolve({ slug: 'the-bell' }) },
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('GET /api/restaurants', () => {
  beforeEach(() => {
    listRestaurantsMock.mockReset();
  });

  it('returns the restaurant list', async () => {
    listRestaurantsMock.mockResolvedValue([{ id: 'r1' }]);

    const response = await listRestaurants(
      new NextRequest('https://www.nabatable.com/api/restaurants?search=bell'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'r1' }] });
  });

  it('returns a generic 500 without raw failure text when listing throws', async () => {
    listRestaurantsMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL relation restaurants does not exist'),
    );

    const response = await listRestaurants(
      new NextRequest('https://www.nabatable.com/api/restaurants'),
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.parse(text)).toEqual({
      error: 'Failed to list restaurants.',
      code: 'INTERNAL_ERROR',
      message: 'Failed to list restaurants.',
    });
  });
});
