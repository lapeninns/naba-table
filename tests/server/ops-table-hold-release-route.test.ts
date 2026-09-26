import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const releaseTableHoldMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
  getServiceSupabaseClient: vi.fn(),
}));

vi.mock('@/server/team/access', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));

vi.mock('@/server/capacity/holds', () => ({ releaseTableHold: releaseTableHoldMock }));

// CSRF failure telemetry writes security events; keep the suite offline.
vi.mock('@/server/security/events', () => ({ recordSecurityEvent: vi.fn() }));

vi.mock('@/lib/logger', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  logger: loggerMock,
}));

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { MembershipAccessError } from '@/server/team/access';
import { DELETE } from '@/src/app/api/ops/tables/holds/[holdId]/route';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';
const HOLD_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const CSRF_TOKEN = 'ops-hold-csrf-token';

type HoldRow = { id: string; status: string; booking_id: string | null } | null;

type RecordedFilter = [column: string, value: unknown];

function makeHoldClient(
  row: HoldRow,
  error: { message: string; code: string } | null = null,
  ownerRestaurantId: string = RESTAURANT_A,
) {
  const filters: RecordedFilter[] = [];
  const client = {
    from: vi.fn((table: string) => {
      expect(table).toBe('table_holds');
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push([column, value]);
          return chain;
        }),
        // Mirrors the database: a hold of another restaurant is invisible to the scoped query.
        maybeSingle: vi.fn(async () => ({
          data: filters.some(([c, v]) => c === 'restaurant_id' && v === ownerRestaurantId)
            ? row
            : null,
          error,
        })),
      };
      return chain;
    }),
  };
  return { client, filters };
}

function makeSessionClient(userId: string | null = USER_ID) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
}

function request(options: { restaurantId?: string; holdId?: string; csrf?: boolean } = {}) {
  const { restaurantId = RESTAURANT_A, holdId = HOLD_ID, csrf = true } = options;
  return new NextRequest(
    `https://app.nabatable.com/api/ops/tables/holds/${holdId}?restaurantId=${restaurantId}`,
    {
      method: 'DELETE',
      headers: csrf
        ? { [CSRF_HEADER_NAME]: CSRF_TOKEN, cookie: `${CSRF_COOKIE_NAME}=${CSRF_TOKEN}` }
        : {},
    },
  );
}

function context(holdId = HOLD_ID) {
  return { params: Promise.resolve({ holdId }) };
}

describe('DELETE /api/ops/tables/holds/[holdId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSessionClient());
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    releaseTableHoldMock.mockResolvedValue(undefined);
  });

  it('releases an active hold with a tenant service client and records the actor', async () => {
    const { client, filters } = makeHoldClient({ id: HOLD_ID, status: 'active', booking_id: null });
    getTenantServiceSupabaseClientMock.mockReturnValue(client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { holdId: HOLD_ID, released: true, alreadyReleased: false },
    });
    expect(getTenantServiceSupabaseClientMock).toHaveBeenCalledWith(RESTAURANT_A);
    expect(filters).toEqual(
      expect.arrayContaining([
        ['id', HOLD_ID],
        ['restaurant_id', RESTAURANT_A],
      ]),
    );
    expect(releaseTableHoldMock).toHaveBeenCalledWith({
      holdId: HOLD_ID,
      client,
      actorId: USER_ID,
    });
    expect(loggerMock.info).toHaveBeenCalledWith(
      'ops.table_hold.released',
      expect.objectContaining({
        restaurantId: RESTAURANT_A,
        holdId: HOLD_ID,
        alreadyReleased: false,
      }),
    );
  });

  it('does not require a booking: unbound holds release too', async () => {
    const { client } = makeHoldClient({ id: HOLD_ID, status: 'active', booking_id: null });
    getTenantServiceSupabaseClientMock.mockReturnValue(client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    expect(releaseTableHoldMock).toHaveBeenCalledTimes(1);
  });

  it('is an idempotent success for a hold that is no longer active', async () => {
    const { client } = makeHoldClient({ id: HOLD_ID, status: 'expired', booking_id: null });
    getTenantServiceSupabaseClientMock.mockReturnValue(client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { holdId: HOLD_ID, released: true, alreadyReleased: true },
    });
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('answers 404 HOLD_NOT_FOUND for a hold of another restaurant and never releases it', async () => {
    // The hold exists, but under restaurant B: the lookup scoped to A cannot see it.
    const { client, filters } = makeHoldClient(
      { id: HOLD_ID, status: 'active', booking_id: null },
      null,
      RESTAURANT_B,
    );
    getTenantServiceSupabaseClientMock.mockReturnValue(client);

    const response = await DELETE(request(), context());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'HOLD_NOT_FOUND' });
    expect(filters).toContainEqual(['restaurant_id', RESTAURANT_A]);
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed hold id without touching the database', async () => {
    const response = await DELETE(request({ holdId: 'nope' }), context('nope'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'HOLD_NOT_FOUND' });
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('rejects non-members with 403 before loading the hold', async () => {
    requireMembershipForRestaurantMock.mockRejectedValue(
      new MembershipAccessError({
        status: 403,
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'not a member',
      }),
    );

    const response = await DELETE(request(), context());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(getTenantServiceSupabaseClientMock).not.toHaveBeenCalled();
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('rejects a request without the CSRF token before any auth work', async () => {
    const response = await DELETE(request({ csrf: false }), context());

    expect(response.status).toBe(403);
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('rejects a missing or malformed restaurant id', async () => {
    const response = await DELETE(request({ restaurantId: 'x' }), context());

    expect(response.status).toBe(400);
    expect(releaseTableHoldMock).not.toHaveBeenCalled();
  });

  it('maps a release failure to a generic 500 without database text', async () => {
    const { client } = makeHoldClient({ id: HOLD_ID, status: 'active', booking_id: null });
    getTenantServiceSupabaseClientMock.mockReturnValue(client);
    releaseTableHoldMock.mockRejectedValue(new Error('permission denied for table secret_holds'));

    const response = await DELETE(request(), context());

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('secret_holds');
  });
});
