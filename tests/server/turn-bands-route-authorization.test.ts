import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const replaceRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());
const getServicePeriodsMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof LoggerModule>()),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerException: vi.fn(),
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
  replaceRestaurantTurnBands: replaceRestaurantTurnBandsMock,
}));

vi.mock('@/server/restaurants/servicePeriods', () => ({
  getServicePeriods: getServicePeriodsMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
}));

import { GET, PUT } from '@/src/app/api/ops/restaurants/[id]/turn-bands/route';

import type * as LoggerModule from '@/lib/logger';

const RESTAURANT_ID = 'rest-1';
const SESSION_CLIENT = { auth: { getUser: getUserMock }, session: true };
const SERVICE_CLIENT = { service: true };

function routeContext() {
  return { params: Promise.resolve({ id: RESTAURANT_ID }) };
}

function putRequest(body: unknown = { lunch: [{ maxPartySize: 4, durationMinutes: 90 }] }) {
  return new NextRequest(
    `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/turn-bands`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

function getRequest() {
  return new NextRequest(
    `https://app.nabatable.com/api/ops/restaurants/${RESTAURANT_ID}/turn-bands`,
  );
}

function membershipError(code: string) {
  return Object.assign(new Error('membership check failed'), { code });
}

describe('turn-bands route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(SESSION_CLIENT);
    getServiceSupabaseClientMock.mockReturnValue(SERVICE_CLIENT);
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1', email: null } }, error: null });
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });
    getRestaurantTurnBandsMock.mockResolvedValue({});
    replaceRestaurantTurnBandsMock.mockResolvedValue({
      lunch: [{ maxPartySize: 4, durationMinutes: 90 }],
    });
    getServicePeriodsMock.mockResolvedValue([]);
  });

  it('PUT returns 401 without a session and never creates a service client', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const response = await PUT(putRequest(), routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(replaceRestaurantTurnBandsMock).not.toHaveBeenCalled();
  });

  it('PUT returns 403 for a non-admin member and never creates a service client', async () => {
    requireAdminMembershipMock.mockRejectedValue(membershipError('MEMBERSHIP_ROLE_DENIED'));

    const response = await PUT(putRequest(), routeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'user-1',
      restaurantId: RESTAURANT_ID,
      client: SESSION_CLIENT,
    });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(replaceRestaurantTurnBandsMock).not.toHaveBeenCalled();
  });

  it('PUT authorises before validating the body', async () => {
    requireAdminMembershipMock.mockRejectedValue(membershipError('MEMBERSHIP_NOT_FOUND'));

    const response = await PUT(putRequest({ lunch: 'not-an-array' }), routeContext());

    expect(response.status).toBe(403);
  });

  it('PUT returns a retryable-safe 500 when membership cannot be validated', async () => {
    requireAdminMembershipMock.mockRejectedValue(
      membershipError('MEMBERSHIP_VALIDATION_UNAVAILABLE'),
    );

    const response = await PUT(putRequest(), routeContext());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('PUT writes through the service client, scoped to the route restaurant, for an admin', async () => {
    const response = await PUT(putRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(requireAdminMembershipMock).toHaveBeenCalledTimes(1);
    expect(getServiceSupabaseClientMock).toHaveBeenCalledTimes(1);
    expect(replaceRestaurantTurnBandsMock).toHaveBeenCalledWith(
      RESTAURANT_ID,
      { lunch: [{ maxPartySize: 4, durationMinutes: 90 }] },
      SERVICE_CLIENT,
    );
    // The membership check completed before the service client was created.
    expect(requireAdminMembershipMock.mock.invocationCallOrder[0]).toBeLessThan(
      getServiceSupabaseClientMock.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('GET returns 403 for a non-admin and reads nothing', async () => {
    requireAdminMembershipMock.mockRejectedValue(membershipError('MEMBERSHIP_ROLE_DENIED'));

    const response = await GET(getRequest(), routeContext());

    expect(response.status).toBe(403);
    expect(getRestaurantTurnBandsMock).not.toHaveBeenCalled();
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('GET reads with the session client for an admin', async () => {
    const response = await GET(getRequest(), routeContext());

    expect(response.status).toBe(200);
    expect(getRestaurantTurnBandsMock).toHaveBeenCalledWith(RESTAURANT_ID, SESSION_CLIENT);
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });
});
