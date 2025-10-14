import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from './route';

const getDetailsMock = vi.fn();
const updateDetailsMock = vi.fn();
const getUserMock = vi.fn();
const requireMembershipMock = vi.fn();

vi.mock('@/server/restaurants/details', () => ({
  getRestaurantDetails: (...args: unknown[]) => getDetailsMock(...args),
  updateRestaurantDetails: (...args: unknown[]) => updateDetailsMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: (...args: unknown[]) => requireMembershipMock(...args),
}));

describe('/api/owner/restaurants/[id]/details', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication on GET', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns restaurant details on GET', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);
    getDetailsMock.mockResolvedValue({
      restaurantId: 'rest-1',
      name: 'My Restaurant',
      timezone: 'Europe/London',
      capacity: 80,
      contactEmail: 'hello@example.com',
      contactPhone: '123456789',
    });

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.name).toBe('My Restaurant');
    expect(getDetailsMock).toHaveBeenCalledWith('rest-1');
  });

  it('validates payload on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ timezone: '', name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(400);
    expect(updateDetailsMock).not.toHaveBeenCalled();
  });

  it('updates restaurant details on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);
    updateDetailsMock.mockResolvedValue({
      restaurantId: 'rest-1',
      name: 'Updated',
      timezone: 'Europe/Paris',
      capacity: 100,
      contactEmail: 'hi@example.com',
      contactPhone: '987654321',
    });

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated',
        timezone: 'Europe/Paris',
        capacity: 100,
        phone: '987654321',
        email: 'hi@example.com',
      }),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(updateDetailsMock).toHaveBeenCalled();
  });
});
