import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getOccasionCatalogMock = vi.hoisted(() => vi.fn());
const getOperatingHoursMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const syncRestaurantOperatingHoursWithGoogleBusinessProfileMock = vi.hoisted(() => vi.fn());
const syncRestaurantServicePeriodsWithGoogleBusinessProfileMock = vi.hoisted(() => vi.fn());
const updateOperatingHoursMock = vi.hoisted(() => vi.fn());
const updateServicePeriodsMock = vi.hoisted(() => vi.fn());
const verifyUserPasswordConfirmationMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/password-confirmation', () => ({
  PasswordConfirmationError: class PasswordConfirmationError extends Error {
    code = 'PASSWORD_CONFIRMATION_FAILED';
    status = 403;
  },
  verifyUserPasswordConfirmation: verifyUserPasswordConfirmationMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  syncRestaurantOperatingHoursWithGoogleBusinessProfile:
    syncRestaurantOperatingHoursWithGoogleBusinessProfileMock,
  syncRestaurantServicePeriodsWithGoogleBusinessProfile:
    syncRestaurantServicePeriodsWithGoogleBusinessProfileMock,
}));

vi.mock('@/server/occasions/catalog', () => ({
  getOccasionCatalog: getOccasionCatalogMock,
}));

vi.mock('@/server/restaurants/operatingHours', () => ({
  getOperatingHours: getOperatingHoursMock,
  updateOperatingHours: updateOperatingHoursMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: getServicePeriodsMock,
  updateServicePeriods: updateServicePeriodsMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

import { PUT as putOperatingHours } from '@/src/app/api/ops/restaurants/[id]/hours/route';
import { PUT as putServicePeriods } from '@/src/app/api/ops/restaurants/[id]/service-periods/route';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function jsonRequest(path: string, body: unknown, method = 'PUT') {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method,
    body: JSON.stringify(body),
  });
}

function mockAuthenticatedSupabase(userId = 'user-1') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId, email: 'owner@example.com' } },
        error: null,
      }),
    },
  };
}

describe('ops restaurant schedule setting routes', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getOccasionCatalogMock.mockReset();
    getOperatingHoursMock.mockReset();
    getServicePeriodsMock.mockReset();
    requireAdminMembershipMock.mockReset();
    syncRestaurantOperatingHoursWithGoogleBusinessProfileMock.mockReset();
    syncRestaurantServicePeriodsWithGoogleBusinessProfileMock.mockReset();
    updateOperatingHoursMock.mockReset();
    updateServicePeriodsMock.mockReset();
    verifyUserPasswordConfirmationMock.mockReset();

    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());
    requireAdminMembershipMock.mockResolvedValue({ role: 'manager' });
    getOccasionCatalogMock.mockResolvedValue({
      definitions: [{ key: 'lunch' }, { key: 'dinner' }],
    });
    updateOperatingHoursMock.mockResolvedValue({
      weekly: [],
      overrides: [],
    });
    updateServicePeriodsMock.mockResolvedValue([]);
  });

  it('rejects invalid operating-hours payloads before auth or replacement @p1 @api @contract', async () => {
    const response = await putOperatingHours(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/hours`, {
        weekly: [{ dayOfWeek: 1, opensAt: '17:00', isClosed: false }],
        overrides: [],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid payload');
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
  });

  it('saves reversible operating-hours snapshots for active restaurant admins @p1 @api @destructive', async () => {
    const supabase = mockAuthenticatedSupabase('admin-1');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    updateOperatingHoursMock.mockResolvedValue({
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '17:00',
          closesAt: '22:00',
          isClosed: false,
        },
      ],
      overrides: [],
    });

    const response = await putOperatingHours(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/hours`, {
        weekly: [
          {
            dayOfWeek: 1,
            opensAt: '17:00',
            closesAt: '22:00',
            isClosed: false,
            notes: 'QA reversible edit',
          },
        ],
        overrides: [],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weekly[0]).toMatchObject({ dayOfWeek: 1, opensAt: '17:00' });
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'admin-1',
      restaurantId: RESTAURANT_ID,
      client: supabase,
    });
    expect(updateOperatingHoursMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      weekly: [
        {
          dayOfWeek: 1,
          opensAt: '17:00',
          closesAt: '22:00',
          isClosed: false,
          notes: 'QA reversible edit',
        },
      ],
      overrides: [],
    });
  });

  it('blocks unauthenticated service-period updates before replacement @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const response = await putServicePeriods(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/service-periods`, [
        {
          name: 'Dinner',
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ]),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Authentication required' });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });

  it('normalizes and saves service periods for active restaurant admins @p1 @api @destructive', async () => {
    const supabase = mockAuthenticatedSupabase('admin-2');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    updateServicePeriodsMock.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);

    const response = await putServicePeriods(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/service-periods`, [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: ' Dinner ',
        },
      ]),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      restaurantId: RESTAURANT_ID,
      periods: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ],
    });
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'admin-2',
      restaurantId: RESTAURANT_ID,
      client: supabase,
    });
    expect(updateServicePeriodsMock).toHaveBeenCalledWith(RESTAURANT_ID, [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Dinner',
        dayOfWeek: 5,
        startTime: '17:00',
        endTime: '22:00',
        bookingOption: 'dinner',
      },
    ]);
  });

  it('rejects unknown service-period occasions before replacement @p1 @api @contract', async () => {
    const response = await putServicePeriods(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/service-periods`, [
        {
          name: 'Chef Counter',
          dayOfWeek: 5,
          startTime: '18:00',
          endTime: '21:00',
          bookingOption: 'chef_counter',
        },
      ]),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Unknown occasion "chef_counter"' });
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });
});
