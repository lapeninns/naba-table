import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());
const requireAdminMembershipMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

vi.mock('@/server/team/access', () => ({
  requireAdminMembership: requireAdminMembershipMock,
}));

import { GET, POST } from '@/src/app/api/ops/strategies/simulate/route';

const RESTAURANT_ID = '33333333-3333-4333-8333-333333333333';
const PINNED_NOW = '2026-07-11T12:00:00.000Z';

const VALID_PAYLOAD = {
  restaurantId: RESTAURANT_ID,
  strategies: [
    {
      key: 'scarcity-first',
      label: 'Scarcity first',
      weights: { scarcity: 10, demandMultiplier: 1.5, futureConflictPenalty: 250 },
    },
  ],
};

function postRequest(body: string) {
  return new NextRequest('https://app.nabatable.com/api/ops/strategies/simulate', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
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

describe('POST /api/ops/strategies/simulate', () => {
  beforeEach(() => {
    getRouteHandlerSupabaseClientMock.mockReset();
    requireAdminMembershipMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@api @security requires authentication before parsing the payload', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const response = await POST(postRequest(JSON.stringify(VALID_PAYLOAD)));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Sign in to continue.',
      code: 'UNAUTHENTICATED',
      message: 'Sign in to continue.',
    });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
  });

  it('@api @security maps supabase auth failures to 401 UNAUTHENTICATED', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { status: 401, message: 'jwt expired' },
        }),
      },
    });

    const response = await POST(postRequest(JSON.stringify(VALID_PAYLOAD)));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', '{not-json'],
    ['missing restaurantId', JSON.stringify({ strategies: VALID_PAYLOAD.strategies })],
    ['non-uuid restaurantId', JSON.stringify({ ...VALID_PAYLOAD, restaurantId: 'not-a-uuid' })],
    ['empty strategies array', JSON.stringify({ restaurantId: RESTAURANT_ID, strategies: [] })],
    [
      'out-of-range weights',
      JSON.stringify({
        restaurantId: RESTAURANT_ID,
        strategies: [
          {
            key: 'k',
            label: 'L',
            weights: { scarcity: 99999, demandMultiplier: 1, futureConflictPenalty: 0 },
          },
        ],
      }),
    ],
  ])('@api rejects %s with 400 before the membership check', async (_name, body) => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase());

    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'Some fields need attention.',
    });
    expect(json.fields).toEqual(expect.any(Object));
    expect(requireAdminMembershipMock).not.toHaveBeenCalled();
  });

  it('@api @security rejects non-admin members with 403', async () => {
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase('user-123'));
    requireAdminMembershipMock.mockRejectedValue(new Error('role denied'));

    const response = await POST(postRequest(JSON.stringify(VALID_PAYLOAD)));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You don't have permission to do that.",
      code: 'FORBIDDEN',
      message: "You don't have permission to do that.",
    });
    expect(requireAdminMembershipMock).toHaveBeenCalledWith({
      userId: 'user-123',
      restaurantId: RESTAURANT_ID,
    });
  });

  it('@api queues the simulation for an admin with a deterministic receipt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(PINNED_NOW));
    getRouteHandlerSupabaseClientMock.mockResolvedValue(mockAuthenticatedSupabase('admin-1'));
    requireAdminMembershipMock.mockResolvedValue({ role: 'owner' });

    const response = await POST(postRequest(JSON.stringify(VALID_PAYLOAD)));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      status: 'queued',
      restaurantId: RESTAURANT_ID,
      receivedAt: PINNED_NOW,
      strategies: [
        {
          key: 'scarcity-first',
          label: 'Scarcity first',
          weights: { scarcity: 10, demandMultiplier: 1.5, futureConflictPenalty: 250 },
        },
      ],
      notes: null,
      message: expect.stringContaining('not yet implemented'),
    });
  });

  it('@api rejects GET with 405 METHOD_NOT_ALLOWED', async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    await expect(response.json()).resolves.toEqual({
      error: 'Method not allowed.',
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed.',
    });
  });
});
