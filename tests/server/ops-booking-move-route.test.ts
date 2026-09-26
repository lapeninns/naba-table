import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const withBookingAuthorizationMock = vi.hoisted(() => vi.fn());
const getTenantServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const invalidateOpsDashboardCachesMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => ({
  withBookingAuthorization: withBookingAuthorizationMock,
}));

vi.mock('@/server/supabase', () => ({
  getTenantServiceSupabaseClient: getTenantServiceSupabaseClientMock,
}));

vi.mock('@/server/ops/bookings', () => ({
  invalidateOpsDashboardCaches: invalidateOpsDashboardCachesMock,
}));

vi.mock('@/lib/posthog/server', () => ({
  captureRestaurantServerEvent: vi.fn(),
  captureServerException: vi.fn(),
}));

import { POST } from '@/src/app/api/ops/bookings/[id]/move-tables/route';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_RESTAURANT_ID = '44444444-4444-4444-8444-444444444444';
const TABLE_A = '22222222-2222-4222-8222-22222222000a';
const TABLE_B = '22222222-2222-4222-8222-22222222000b';
const USER_ID = '55555555-5555-4555-8555-555555555555';

function makeRequest(body: unknown) {
  return new NextRequest(`https://app.nabatable.com/api/ops/bookings/${BOOKING_ID}/move-tables`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function makeContext(id = BOOKING_ID) {
  return { params: Promise.resolve({ id }) };
}

const VALID_BODY = {
  fromTableIds: [TABLE_A],
  toTableIds: [TABLE_B],
  idempotencyKey: 'move-intent-1',
};

function rpcError(code: string, message: string, details: string | null = null) {
  return { data: null, error: { code, message, details, hint: 'raw hint from postgres' } };
}

describe('POST /api/ops/bookings/[id]/move-tables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withBookingAuthorizationMock.mockResolvedValue({
      ok: true,
      user: { id: USER_ID },
      supabase: {},
      bookingId: BOOKING_ID,
      restaurantId: RESTAURANT_ID,
      membership: { role: 'host' },
    });
    getTenantServiceSupabaseClientMock.mockReturnValue({ rpc: rpcMock });
    rpcMock.mockResolvedValue({
      data: [
        {
          replayed: false,
          booking_status: 'confirmed',
          booking_party_size: 2,
          booking_updated_at: '2026-09-26T19:00:00.000Z',
          booking_date: '2026-09-26',
          assignments: [
            {
              id: 'assignment-1',
              booking_id: BOOKING_ID,
              table_id: TABLE_B,
              assigned_at: '2026-09-26T19:00:00.000Z',
              assigned_by: USER_ID,
            },
          ],
          table_count: 1,
          total_capacity: 4,
        },
      ],
      error: null,
    });
  });

  it('moves tables atomically and mirrors the assign-tables success body', async () => {
    const response = await POST(makeRequest(VALID_BODY), makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      assignments: [
        {
          id: 'assignment-1',
          booking_id: BOOKING_ID,
          table_id: TABLE_B,
          assigned_at: '2026-09-26T19:00:00.000Z',
          assigned_by: USER_ID,
        },
      ],
      booking: { id: BOOKING_ID, status: 'confirmed', party_size: 2 },
      summary: { tableCount: 1, totalCapacity: 4, partySize: 2, slack: 2 },
    });
    expect(getTenantServiceSupabaseClientMock).toHaveBeenCalledWith(RESTAURANT_ID);
    expect(rpcMock).toHaveBeenCalledWith('move_booking_tables', {
      p_booking_id: BOOKING_ID,
      p_restaurant_id: RESTAURANT_ID,
      p_from_table_ids: [TABLE_A],
      p_to_table_ids: [TABLE_B],
      p_idempotency_key: 'move-intent-1',
      p_moved_by: USER_ID,
    });
    expect(invalidateOpsDashboardCachesMock).toHaveBeenCalledWith(RESTAURANT_ID, {
      summaryDates: ['2026-09-26'],
    });
  });

  it('authorizes against the booking (CSRF + membership) before touching the database', async () => {
    withBookingAuthorizationMock.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
    });

    const response = await POST(makeRequest(VALID_BODY), makeContext());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ code: 'FORBIDDEN', message: 'Forbidden', error: 'Forbidden' });
    expect(withBookingAuthorizationMock).toHaveBeenCalledWith(expect.any(NextRequest), BOOKING_ID, {
      action: 'move-tables',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the body names another restaurant', async () => {
    const response = await POST(
      makeRequest({ ...VALID_BODY, restaurantId: OTHER_RESTAURANT_ID }),
      makeContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'BOOKING_NOT_FOUND' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid body with C1 field errors', async () => {
    const response = await POST(
      makeRequest({ fromTableIds: [TABLE_A], toTableIds: ['not-a-uuid'] }),
      makeContext(),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(body.fields)).toEqual(
      expect.arrayContaining(['toTableIds.0', 'idempotencyKey']),
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps tables_unavailable to 409 TABLES_UNAVAILABLE with safe details only', async () => {
    rpcMock.mockResolvedValue(
      rpcError(
        'P0001',
        'tables_unavailable',
        JSON.stringify({ reason: 'CONFLICT', tableIds: [TABLE_B] }),
      ),
    );

    const response = await POST(makeRequest(VALID_BODY), makeContext());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'TABLES_UNAVAILABLE',
      details: { reason: 'CONFLICT', tableIds: [TABLE_B] },
    });
    expect(JSON.stringify(body)).not.toContain('raw hint');
    expect(JSON.stringify(body)).not.toContain('tables_unavailable');
    expect(invalidateOpsDashboardCachesMock).not.toHaveBeenCalled();
  });

  it('maps a lost compare-and-set to 409 BOOKING_STATE_CONFLICT with the current status', async () => {
    rpcMock.mockResolvedValue(
      rpcError(
        'P0004',
        'booking_state_conflict',
        JSON.stringify({ currentStatus: 'completed', reason: 'STATUS' }),
      ),
    );

    const response = await POST(makeRequest(VALID_BODY), makeContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BOOKING_STATE_CONFLICT',
      retryable: false,
      details: { currentStatus: 'completed', reason: 'STATUS' },
    });
  });

  it('maps a reused idempotency key to 409 IDEMPOTENCY_KEY_REUSED', async () => {
    rpcMock.mockResolvedValue(rpcError('P0003', 'idempotency_key_reused'));

    const response = await POST(makeRequest(VALID_BODY), makeContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('maps an invalid resulting selection to 422 TABLE_SELECTION_INVALID', async () => {
    rpcMock.mockResolvedValue(
      rpcError('P0001', 'table_selection_invalid', JSON.stringify({ reason: 'CAPACITY' })),
    );

    const response = await POST(makeRequest(VALID_BODY), makeContext());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'TABLE_SELECTION_INVALID',
      details: { reason: 'CAPACITY' },
    });
  });

  it('never forwards unexpected database text', async () => {
    rpcMock.mockResolvedValue(
      rpcError('42P01', 'relation "public.booking_table_moves" does not exist'),
    );

    const response = await POST(makeRequest(VALID_BODY), makeContext());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('booking_table_moves');
  });
});
