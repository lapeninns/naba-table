import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const fetchTableByIdMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/ops/tables', () => ({
  fetchTableById: fetchTableByIdMock,
  updateTable: vi.fn(),
}));

vi.mock('@/server/security/csrf', () => ({
  withCsrfProtectedMutation: vi.fn((_req: NextRequest, work: () => Promise<Response>) => work()),
}));

import { DELETE } from '@/src/app/api/ops/tables/[id]/route';

const TABLE_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

function request() {
  return new NextRequest(`https://app.nabatable.com/api/ops/tables/${TABLE_ID}`, {
    method: 'DELETE',
  });
}

function routeContext() {
  return { params: Promise.resolve({ id: TABLE_ID }) };
}

function makeRouteSupabase() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: { role: 'owner' }, error: null })),
    })),
  };
}

describe('DELETE /api/ops/tables/[id]', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    fetchTableByIdMock.mockReset();
    fetchTableByIdMock.mockResolvedValue({
      id: TABLE_ID,
      restaurant_id: RESTAURANT_ID,
      table_number: '12',
    });
  });

  it('uses guarded service-role delete and maps active assignment conflicts to 409', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(makeRouteSupabase());
    const serviceClient = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'Cannot delete table with active or future booking assignments' },
      })),
    };
    getServiceSupabaseClientMock.mockReturnValue(serviceClient);

    const response = await DELETE(request(), routeContext());

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'TABLE_HAS_BOOKINGS' });
    expect(body.error).toBe(body.message);
    expect(JSON.stringify(body)).not.toContain('booking assignments');
    expect(serviceClient.rpc).toHaveBeenCalledWith('delete_table_inventory_guarded', {
      p_table_id: TABLE_ID,
      p_current_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });
});
