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

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: vi.fn(),
}));

import {
  POST as postOperatingHours,
  PUT as putOperatingHours,
} from '@/src/app/api/ops/restaurants/[id]/hours/route';
import {
  POST as postServicePeriods,
  PUT as putServicePeriods,
} from '@/src/app/api/ops/restaurants/[id]/service-periods/route';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../lib/security/csrf';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const CSRF_TOKEN = 'restaurant-schedule-csrf-token';

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function csrfHeaders() {
  return {
    [CSRF_HEADER_NAME]: CSRF_TOKEN,
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}`,
  };
}

function jsonRequest(path: string, body: unknown, method = 'PUT', includeCsrf = true) {
  return new NextRequest(`https://app.nabatable.com${path}`, {
    method,
    body: JSON.stringify(body),
    headers: includeCsrf ? csrfHeaders() : undefined,
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

  it('authorises before reading an operating-hours body @p1 @api @security', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
    const request = jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/hours`, {
      weekly: [{ dayOfWeek: 1, opensAt: '17:00', isClosed: false }],
      overrides: [],
    });
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await putOperatingHours(request, routeContext());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ code: 'UNAUTHENTICATED', error: 'Authentication required' });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
  });

  it('rejects invalid operating-hours payloads with field errors before replacement @p1 @api @contract', async () => {
    const response = await putOperatingHours(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/hours`, {
        weekly: [{ dayOfWeek: 1, opensAt: '17:00', isClosed: false }],
        overrides: [],
      }),
      routeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.fields).toHaveProperty('weekly.0');
    expect(updateOperatingHoursMock).not.toHaveBeenCalled();
  });

  it('refuses a non-admin before parsing the body or reading the occasion catalog @p1 @api @security', async () => {
    requireAdminMembershipMock.mockRejectedValue(
      Object.assign(new Error('Membership not found'), { code: 'MEMBERSHIP_NOT_FOUND' }),
    );
    const request = jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/service-periods`, [
      { name: 'Dinner', dayOfWeek: 1, startTime: '17:00', endTime: '22:00', bookingOption: 'x' },
    ]);
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await putServicePeriods(request, routeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(getOccasionCatalogMock).not.toHaveBeenCalled();
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
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
    expect(body).toMatchObject({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(getOccasionCatalogMock).not.toHaveBeenCalled();
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

  it('maps a booking type removed during the save (FK 23503 from the replacement) to UNKNOWN_BOOKING_TYPE', async () => {
    updateServicePeriodsMock.mockRejectedValueOnce(
      Object.assign(new Error('service period uses a removed booking type'), { code: '23503' }),
    );
    const response = await putServicePeriods(
      jsonRequest(`/api/ops/restaurants/${RESTAURANT_ID}/service-periods`, [
        {
          name: 'Dinner',
          dayOfWeek: 5,
          startTime: '17:00',
          endTime: '22:00',
          bookingOption: 'dinner',
        },
      ]),
      routeContext(),
    );
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(JSON.parse(text).code).toBe('UNKNOWN_BOOKING_TYPE');
    expect(text).not.toContain('removed booking type');
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
    expect(body).toMatchObject({
      code: 'UNKNOWN_BOOKING_TYPE',
      fields: { '0.bookingOption': ['Unknown booking type'] },
    });
    expect(updateServicePeriodsMock).not.toHaveBeenCalled();
  });

  it.each([
    ['hours PUT', putOperatingHours, `/api/ops/restaurants/${RESTAURANT_ID}/hours`, 'PUT'],
    ['hours POST', postOperatingHours, `/api/ops/restaurants/${RESTAURANT_ID}/hours`, 'POST'],
    [
      'service-periods PUT',
      putServicePeriods,
      `/api/ops/restaurants/${RESTAURANT_ID}/service-periods`,
      'PUT',
    ],
    [
      'service-periods POST',
      postServicePeriods,
      `/api/ops/restaurants/${RESTAURANT_ID}/service-periods`,
      'POST',
    ],
  ] as const)(
    'rejects missing CSRF on %s before parsing the request body',
    async (_label, handler, path, method) => {
      const request = jsonRequest(
        path,
        { password: 'password-1', weekly: [], overrides: [] },
        method,
        false,
      );
      const jsonSpy = vi.spyOn(request, 'json');

      const response = await handler(request, routeContext());
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.code).toBe('CSRF_INVALID');
      expect(jsonSpy).not.toHaveBeenCalled();
      expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
      expect(updateOperatingHoursMock).not.toHaveBeenCalled();
      expect(updateServicePeriodsMock).not.toHaveBeenCalled();
      expect(verifyUserPasswordConfirmationMock).not.toHaveBeenCalled();
    },
  );
});
