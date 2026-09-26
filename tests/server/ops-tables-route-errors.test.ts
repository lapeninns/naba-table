import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const listTablesWithSummaryMock = vi.hoisted(() => vi.fn());
const findTableByNumberMock = vi.hoisted(() => vi.fn());
const insertTableMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));
vi.mock('@/server/team/access', () => ({
  requireMembershipForRestaurant: requireMembershipForRestaurantMock,
}));
vi.mock('@/server/ops/tables', () => ({
  findTableByNumber: findTableByNumberMock,
  insertTable: insertTableMock,
  listTables: vi.fn(),
  listTablesWithSummary: listTablesWithSummaryMock,
}));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));
vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { GET, POST } from '@/src/app/api/ops/tables/route';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';
const ZONE_ID = '33333333-3333-4333-8333-333333333333';

type Fixture = { role?: string | null; zoneRestaurantId?: string | null; user?: boolean };

function makeSupabase({
  role = 'owner',
  zoneRestaurantId = RESTAURANT_A,
  user = true,
}: Fixture = {}) {
  return {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: user ? { id: 'user-1' } : null }, error: null }),
    },
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => {
          if (table === 'restaurant_memberships') {
            return { data: role ? { role } : null, error: null };
          }
          return {
            data: zoneRestaurantId ? { id: ZONE_ID, restaurant_id: zoneRestaurantId } : null,
            error: null,
          };
        }),
      };
      return chain;
    }),
  };
}

function post(body: unknown) {
  return new NextRequest('https://app.nabatable.com/api/ops/tables', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = { restaurantId: RESTAURANT_A, tableNumber: '7', capacity: 4, zoneId: ZONE_ID };

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

describe('/api/ops/tables C1 errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase());
    findTableByNumberMock.mockResolvedValue(null);
  });

  it('GET: 401 without a session and 400 with field errors for a bad restaurant id', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase({ user: false }));
    const unauth = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/tables?restaurantId=${RESTAURANT_A}`),
    );
    expect(unauth.status).toBe(401);
    await expect(unauth.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase());
    const bad = await GET(
      new NextRequest('https://app.nabatable.com/api/ops/tables?restaurantId=x'),
    );
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { restaurantId: [expect.any(String)] },
    });
  });

  it('GET: an unexpected failure is a generic 500 with no error text', async () => {
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    listTablesWithSummaryMock.mockRejectedValue(new Error('relation "secret" does not exist'));

    const response = await GET(
      new NextRequest(`https://app.nabatable.com/api/ops/tables?restaurantId=${RESTAURANT_A}`),
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('secret');
  });

  it('POST: 403 codes for non-members and non-admins', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase({ role: null }));
    const nonMember = await POST(post(validBody));
    expect(nonMember.status).toBe(403);
    await expect(nonMember.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeSupabase({ role: 'host' }));
    const host = await POST(post(validBody));
    expect(host.status).toBe(403);
    await expect(host.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
    expect(insertTableMock).not.toHaveBeenCalled();
  });

  it('POST: a zone from another restaurant is a field error, not a leak of its existence', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(
      makeSupabase({ zoneRestaurantId: RESTAURANT_B }),
    );

    const response = await POST(post(validBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { zoneId: [expect.any(String)] },
    });
  });

  it('POST: duplicates are TABLE_NUMBER_TAKEN from the pre-check and from the unique constraint', async () => {
    findTableByNumberMock.mockResolvedValueOnce({ id: 'existing' });
    const precheck = await POST(post(validBody));
    expect(precheck.status).toBe(409);
    await expect(precheck.json()).resolves.toMatchObject({ code: 'TABLE_NUMBER_TAKEN' });

    insertTableMock.mockRejectedValueOnce(pgError('23505', 'duplicate key value violates'));
    const raced = await POST(post(validBody));
    expect(raced.status).toBe(409);
    const text = await raced.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'TABLE_NUMBER_TAKEN' });
    expect(text).not.toContain('duplicate key');
  });

  it('POST: capacity FK is 422 CAPACITY_NOT_CONFIGURED and other failures are generic 500s', async () => {
    insertTableMock.mockRejectedValueOnce(pgError('23503', 'violates foreign key constraint'));
    const fk = await POST(post(validBody));
    expect(fk.status).toBe(422);
    await expect(fk.json()).resolves.toMatchObject({ code: 'CAPACITY_NOT_CONFIGURED' });

    insertTableMock.mockRejectedValueOnce(pgError('XX000', 'internal secret text'));
    const boom = await POST(post(validBody));
    expect(boom.status).toBe(500);
    const text = await boom.text();
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('secret');
  });
});
