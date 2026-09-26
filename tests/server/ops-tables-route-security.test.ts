import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireMembershipForRestaurantMock = vi.hoisted(() => vi.fn());
const listTablesMock = vi.hoisted(() => vi.fn());
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
  listTables: listTablesMock,
  listTablesWithSummary: listTablesWithSummaryMock,
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { GET } from '@/src/app/api/ops/tables/route';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';

function request(path: string) {
  return new NextRequest(`https://app.nabatable.com${path}`);
}

function mockAuthenticatedSupabase(userId = 'user-123') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  };
}

describe('GET /api/ops/tables security', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireMembershipForRestaurantMock.mockReset();
    listTablesMock.mockReset();
    listTablesWithSummaryMock.mockReset();
    findTableByNumberMock.mockReset();
    insertTableMock.mockReset();
  });

  it('rejects cross-tenant table reads before table queries run', async () => {
    const supabase = mockAuthenticatedSupabase();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    requireMembershipForRestaurantMock.mockRejectedValue(new Error('membership denied'));

    const response = await GET(request(`/api/ops/tables?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: 'user-123',
      restaurantId: RESTAURANT_A,
      client: supabase,
    });
    expect(listTablesWithSummaryMock).not.toHaveBeenCalled();
    expect(listTablesMock).not.toHaveBeenCalled();
  });

  it('lists tables after membership validation succeeds', async () => {
    const supabase = mockAuthenticatedSupabase('user-456');
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);
    requireMembershipForRestaurantMock.mockResolvedValue({ role: 'host' });
    listTablesWithSummaryMock.mockResolvedValue({
      tables: [{ id: 'table-1', tableNumber: '1' }],
      summary: { total: 1 },
    });

    const response = await GET(request(`/api/ops/tables?restaurantId=${RESTAURANT_A}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tables: [{ id: 'table-1', tableNumber: '1' }],
      summary: { total: 1 },
    });
    expect(requireMembershipForRestaurantMock).toHaveBeenCalledWith({
      userId: 'user-456',
      restaurantId: RESTAURANT_A,
      client: supabase,
    });
    expect(listTablesWithSummaryMock).toHaveBeenCalledWith(supabase, RESTAURANT_A, {
      section: undefined,
      status: undefined,
      zoneId: undefined,
    });
  });
});
