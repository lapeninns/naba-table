import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, PUT } from './route';

const getServicePeriodsMock = vi.fn();
const updateServicePeriodsMock = vi.fn();
const getUserMock = vi.fn();
const requireAdminMembershipMock = vi.fn();

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: (...args: unknown[]) => getServicePeriodsMock(...args),
  updateServicePeriods: (...args: unknown[]) => updateServicePeriodsMock(...args),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: (...args: unknown[]) => requireAdminMembershipMock(...args),
}));

describe('/api/owner/restaurants/[id]/service-periods', () => {
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

  it('returns service periods on GET', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    getServicePeriodsMock.mockResolvedValue([
      {
        id: 'sp-1',
        name: 'Lunch',
        dayOfWeek: 1,
        startTime: '12:00',
        endTime: '15:00',
        bookingOption: 'lunch',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.periods).toHaveLength(1);
    expect(getServicePeriodsMock).toHaveBeenCalledWith('rest-1');
  });

  it('validates payload on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify([
        { name: '', startTime: '10:00', endTime: '12:00', bookingOption: 'lunch' },
      ]),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(400);
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });

  it('updates service periods on PUT', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    requireAdminMembershipMock.mockResolvedValue(undefined);
    updateServicePeriodsMock.mockResolvedValue([
      {
        id: 'sp-1',
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);

    const request = new NextRequest('http://localhost', {
      method: 'PUT',
      body: JSON.stringify([
        {
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '18:00:00',
          endTime: '22:00:00',
          bookingOption: 'dinner',
        },
      ]),
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node fetch requires duplex for request bodies
      duplex: 'half',
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: 'rest-1' }),
    });

    expect(response.status).toBe(200);
    expect(updateServicePeriodsMock).toHaveBeenCalledWith('rest-1', [
      {
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '18:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);
  });
});
