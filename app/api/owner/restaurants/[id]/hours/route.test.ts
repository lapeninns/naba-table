import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from './route';

const getOperatingHoursMock = vi.fn();
const updateOperatingHoursMock = vi.fn();
const getUserMock = vi.fn();
const requireMembershipMock = vi.fn();

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: (...args: unknown[]) => getOperatingHoursMock(...args),
  updateOperatingHours: (...args: unknown[]) => updateOperatingHoursMock(...args),
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

describe('/api/owner/restaurants/[id]/hours', () => {
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

  it('returns operating hours on GET', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);
    getOperatingHoursMock.mockResolvedValue({
      restaurantId: 'rest-1',
      timezone: 'Europe/London',
      weekly: [],
      overrides: [],
    });

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.restaurantId).toBe('rest-1');
    expect(getOperatingHoursMock).toHaveBeenCalledWith('rest-1');
  });

  it('validates payload on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ weekly: [], overrides: [{ effectiveDate: 'invalid' }] }),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(400);
    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
  });

  it('updates operating hours on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireMembershipMock.mockResolvedValue(undefined);
    updateOperatingHoursMock.mockResolvedValue({
      restaurantId: 'rest-1',
      timezone: 'Europe/London',
      weekly: [],
      overrides: [],
    });

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({
        weekly: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '18:00', isClosed: false }],
        overrides: [],
      }),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(updateOperatingHoursMock).toHaveBeenCalledWith('rest-1', {
      weekly: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '18:00', isClosed: false }],
      overrides: [],
    });
  });
});
