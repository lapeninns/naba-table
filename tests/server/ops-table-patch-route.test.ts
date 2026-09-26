import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchTableByIdMock = vi.hoisted(() => vi.fn());
const fetchTableRecordMock = vi.hoisted(() => vi.fn());
const updateTableAtomicallyMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: vi.fn(),
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

vi.mock('@/server/ops/tables', () => ({
  fetchTableById: fetchTableByIdMock,
  fetchTableRecord: fetchTableRecordMock,
  updateTableAtomically: updateTableAtomicallyMock,
  updateTable: vi.fn(),
}));

vi.mock('@/lib/posthog/server', () => ({ captureServerException: vi.fn() }));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { PATCH } from '@/src/app/api/ops/tables/[id]/route';

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';
const ZONE_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';

const existingTable = {
  id: TABLE_ID,
  restaurant_id: RESTAURANT_ID,
  table_number: '12',
  capacity: 4,
  min_party_size: 1,
  max_party_size: null,
  zone_id: ZONE_ID,
  status: 'available',
};

const serviceClient = { tenant: RESTAURANT_ID };

function request(body: unknown) {
  return new NextRequest(`https://app.nabatable.com/api/ops/tables/${TABLE_ID}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function routeContext() {
  return { params: Promise.resolve({ id: TABLE_ID }) };
}

function makeRouteSupabase(role: string | null = 'owner') {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: role ? { role } : null, error: null })),
    })),
  };
}

function pgError(code: string, message: string) {
  return Object.assign(new Error(message), { code, details: 'secret detail', hint: 'secret hint' });
}

describe('PATCH /api/ops/tables/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeRouteSupabase());
    getTenantServiceSupabaseClientMock.mockReturnValue(serviceClient);
    fetchTableByIdMock.mockResolvedValue(existingTable);
    fetchTableRecordMock.mockResolvedValue({ ...existingTable, table_number: '12A', zone: null });
    updateTableAtomicallyMock.mockResolvedValue(undefined);
  });

  it('writes the row and the maintenance window in one atomic call and returns the canonical row', async () => {
    const response = await PATCH(
      request({
        tableNumber: ' 12A ',
        status: 'out_of_service',
        maintenance: { startIso: '2099-01-01T10:00:00Z', endIso: '2099-01-01T18:00:00Z' },
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      table: { ...existingTable, table_number: '12A', zone: null },
    });
    expect(getTenantServiceSupabaseClientMock).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(updateTableAtomicallyMock).toHaveBeenCalledTimes(1);
    expect(updateTableAtomicallyMock).toHaveBeenCalledWith(serviceClient, {
      tableId: TABLE_ID,
      restaurantId: RESTAURANT_ID,
      patch: { table_number: '12A', status: 'out_of_service' },
      maintenance: {
        startIso: '2099-01-01T10:00:00.000Z',
        endIso: '2099-01-01T18:00:00.000Z',
      },
      actorId: USER_ID,
    });
  });

  it('returns 401 in the C1 shape without a session', async () => {
    const supabase = makeRouteSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    getRouteHandlerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await PATCH(request({ notes: 'x' }), routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(updateTableAtomicallyMock).not.toHaveBeenCalled();
  });

  it('returns 404 TABLE_NOT_FOUND for a table the caller cannot see', async () => {
    fetchTableByIdMock.mockResolvedValue(null);

    const response = await PATCH(request({ notes: 'x' }), routeContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'TABLE_NOT_FOUND' });
  });

  it('returns 403 for non-members and for members below manager', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeRouteSupabase(null));
    const nonMember = await PATCH(request({ notes: 'x' }), routeContext());
    expect(nonMember.status).toBe(403);
    await expect(nonMember.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });

    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeRouteSupabase('host'));
    const host = await PATCH(request({ notes: 'x' }), routeContext());
    expect(host.status).toBe(403);
    await expect(host.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
    expect(updateTableAtomicallyMock).not.toHaveBeenCalled();
  });

  it('returns field errors for invalid input, including a window without out_of_service', async () => {
    const invalid = await PATCH(request({ capacity: 0 }), routeContext());
    expect(invalid.status).toBe(400);
    const invalidBody = await invalid.json();
    expect(invalidBody.code).toBe('VALIDATION_FAILED');
    expect(invalidBody.fields.capacity).toBeDefined();

    const orphanWindow = await PATCH(
      request({
        maintenance: { startIso: '2099-01-01T10:00:00Z', endIso: '2099-01-01T18:00:00Z' },
      }),
      routeContext(),
    );
    expect(orphanWindow.status).toBe(400);
    await expect(orphanWindow.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { maintenance: [expect.any(String)] },
    });

    const range = await PATCH(request({ minPartySize: 6, maxPartySize: 2 }), routeContext());
    expect(range.status).toBe(400);
    await expect(range.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: { maxPartySize: [expect.any(String)] },
    });
    expect(updateTableAtomicallyMock).not.toHaveBeenCalled();
  });

  it.each([
    ['23505', 'duplicate key value violates unique constraint', 409, 'TABLE_NUMBER_TAKEN'],
    ['23P01', 'Assignment conflicts with an active table hold', 409, 'MAINTENANCE_CONFLICT'],
    [
      '23503',
      'violates foreign key constraint table_inventory_allowed_capacity_fkey',
      422,
      'CAPACITY_NOT_CONFIGURED',
    ],
    ['P0002', 'zone_not_found', 400, 'VALIDATION_FAILED'],
    ['P0002', 'table_not_found', 404, 'TABLE_NOT_FOUND'],
    ['XX000', 'relation "secret_table" does not exist', 500, 'INTERNAL_ERROR'],
  ])(
    'maps database error %s (%s) to %i %s without leaking database text',
    async (code, message, status, apiCode) => {
      updateTableAtomicallyMock.mockRejectedValue(pgError(code, message));

      const response = await PATCH(request({ tableNumber: '12A' }), routeContext());

      expect(response.status).toBe(status);
      const text = await response.text();
      expect(JSON.parse(text)).toMatchObject({ code: apiCode });
      expect(text).not.toContain(message);
      expect(text).not.toContain('secret');
      expect(fetchTableRecordMock).not.toHaveBeenCalled();
    },
  );

  it('returns the current row when nothing changes, without writing', async () => {
    const response = await PATCH(request({}), routeContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ table: { id: TABLE_ID } });
    expect(updateTableAtomicallyMock).not.toHaveBeenCalled();
  });
});
