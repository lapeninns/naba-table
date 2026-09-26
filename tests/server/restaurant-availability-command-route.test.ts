import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const saveRestaurantAvailabilityMock = vi.hoisted(() => vi.fn());
const getAvailabilityRevisionMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: loggerErrorMock, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/restaurants/availabilityCommand', async (importOriginal) => {
  const actual = await importOriginal<typeof AvailabilityCommandModule>();
  return {
    AvailabilityCommandError: actual.AvailabilityCommandError,
    saveRestaurantAvailability: saveRestaurantAvailabilityMock,
    getAvailabilityRevision: getAvailabilityRevisionMock,
  };
});

import { AvailabilityCommandError } from '@/server/restaurants/availabilityCommand';
import { GET, PUT } from '@/src/app/api/ops/restaurants/[id]/availability/route';

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../lib/security/csrf';

import type * as LoggerModule from '@/lib/logger';
import type * as AvailabilityCommandModule from '@/server/restaurants/availabilityCommand';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const CSRF_TOKEN = 'availability-csrf-token';
const REVISION = '0123456789abcdef0123456789abcdef';

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function putRequest(body: unknown, includeCsrf = true) {
  return new NextRequest(
    `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/availability`,
    {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: includeCsrf
        ? { [CSRF_HEADER_NAME]: CSRF_TOKEN, cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` }
        : undefined,
    },
  );
}

function sessionWith(user: { id: string; email: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
  };
}

const validBody = {
  hours: {
    weekly: [{ dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false }],
    overrides: [],
  },
  servicePeriods: [
    { name: 'Lunch', dayOfWeek: 1, startTime: '12:00', endTime: '15:00', bookingOption: 'lunch' },
  ],
  turnBands: { lunch: [{ maxPartySize: 4, durationMinutes: 75 }] },
  rules: { reservationIntervalMinutes: 30, reservationDefaultDurationMinutes: 105 },
  expectedRevision: REVISION,
};

const snapshot = {
  restaurantId: RESTAURANT_ID,
  revision: 'fedcba9876543210fedcba9876543210',
  hours: {
    restaurantId: RESTAURANT_ID,
    timezone: 'Europe/London',
    updatedAt: null,
    weekly: [],
    overrides: [],
  },
  servicePeriods: [],
  turnBands: { restaurantId: RESTAURANT_ID, bands: {}, defaults: {} },
  rules: {
    reservationIntervalMinutes: 30,
    reservationDefaultDurationMinutes: 105,
    reservationLastSeatingBufferMinutes: 60,
    reservationLifecycleGraceMinutes: 15,
    bookingPolicy: null,
    updatedAt: '2026-09-27T10:00:00.000Z',
  },
};

describe('PUT /api/ops/restaurants/[id]/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      sessionWith({ id: 'admin-1', email: 'owner@example.com' }),
    );
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    saveRestaurantAvailabilityMock.mockResolvedValue(snapshot);
  });

  it('saves every part in one command and returns the canonical snapshot', async () => {
    const response = await PUT(putRequest(validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: snapshot });
    expect(saveRestaurantAvailabilityMock).toHaveBeenCalledTimes(1);
    expect(saveRestaurantAvailabilityMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        expectedRevision: REVISION,
        rules: { reservationIntervalMinutes: 30, reservationDefaultDurationMinutes: 105 },
        turnBands: { lunch: [{ maxPartySize: 4, durationMinutes: 75 }] },
      }),
    );
  });

  it('authorises before reading the body: an anonymous caller never has it parsed', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(sessionWith(null));
    const request = putRequest({ nonsense: true });
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await PUT(request, routeContext());

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('UNAUTHENTICATED');
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(saveRestaurantAvailabilityMock).not.toHaveBeenCalled();
  });

  it('refuses staff without an admin role before parsing', async () => {
    requireAdminMembershipMock.mockRejectedValue(
      Object.assign(new Error('Insufficient permissions'), { code: 'MEMBERSHIP_ROLE_DENIED' }),
    );
    const request = putRequest(validBody);
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await PUT(request, routeContext());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN');
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(saveRestaurantAvailabilityMock).not.toHaveBeenCalled();
  });

  it('rejects a missing CSRF token before authorising or parsing', async () => {
    const request = putRequest(validBody, false);
    const jsonSpy = vi.spyOn(request, 'json');

    const response = await PUT(request, routeContext());

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('CSRF_INVALID');
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty command', {}],
    ['rules with no fields', { rules: {} }],
    ['an unknown top-level key', { ...validBody, occasions: [] }],
    ['an out-of-range default table time', { rules: { reservationDefaultDurationMinutes: 5 } }],
    ['a malformed revision', { rules: { reservationIntervalMinutes: 30 }, expectedRevision: 'x' }],
    [
      'hours missing a closing time',
      { hours: { weekly: [{ dayOfWeek: 1, opensAt: '12:00', isClosed: false }], overrides: [] } },
    ],
  ])('returns VALIDATION_FAILED for %s without saving', async (_label, body) => {
    const response = await PUT(putRequest(body), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('VALIDATION_FAILED');
    expect(payload.fields).toBeDefined();
    expect(saveRestaurantAvailabilityMock).not.toHaveBeenCalled();
  });

  it('returns INVALID_JSON for a body that is not JSON', async () => {
    const response = await PUT(putRequest('{not json'), routeContext());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_JSON');
  });

  it('maps a stale revision to 409 STALE_WRITE', async () => {
    saveRestaurantAvailabilityMock.mockRejectedValue(
      new AvailabilityCommandError(
        'STALE_WRITE',
        409,
        'These settings were changed somewhere else.',
      ),
    );

    const response = await PUT(putRequest(validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: 'STALE_WRITE', error: body.message });
  });

  it('maps a meal time outside hours to a 400 naming the part', async () => {
    saveRestaurantAvailabilityMock.mockRejectedValue(
      new AvailabilityCommandError(
        'SERVICE_PERIOD_OUTSIDE_HOURS',
        400,
        'A meal time falls outside that day’s opening hours.',
        'servicePeriods',
      ),
    );

    const response = await PUT(putRequest(validBody), routeContext());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'SERVICE_PERIOD_OUTSIDE_HOURS',
      details: { part: 'servicePeriods' },
    });
  });

  it('answers an unexpected failure with a generic 500 and never echoes its text', async () => {
    saveRestaurantAvailabilityMock.mockRejectedValue(
      new Error('SECRET_DB_DETAIL relation "restaurants" owner@example.com'),
    );

    const response = await PUT(putRequest(validBody), routeContext());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text).code).toBe('INTERNAL_ERROR');
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(text).not.toContain('owner@example.com');
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'api.internal_error',
      expect.objectContaining({
        route: 'ops.restaurants.availability',
        restaurantId: RESTAURANT_ID,
      }),
    );
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain('owner@example.com');
  });
});

describe('GET /api/ops/restaurants/[id]/availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      sessionWith({ id: 'admin-1', email: 'owner@example.com' }),
    );
    requireAdminMembershipMock.mockResolvedValue({ role: 'manager' });
  });

  it('returns the current revision to restaurant admins', async () => {
    getAvailabilityRevisionMock.mockResolvedValue(REVISION);

    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/availability`,
      ),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { restaurantId: RESTAURANT_ID, revision: REVISION },
    });
  });

  it('refuses non-admins', async () => {
    requireAdminMembershipMock.mockRejectedValue(
      Object.assign(new Error('Membership not found'), { code: 'MEMBERSHIP_NOT_FOUND' }),
    );

    const response = await GET(
      new NextRequest(
        `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/availability`,
      ),
      routeContext(),
    );

    expect(response.status).toBe(403);
    expect(getAvailabilityRevisionMock).not.toHaveBeenCalled();
  });
});
