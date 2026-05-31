import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const withOpsMutationMock = vi.hoisted(() => vi.fn());
const getRouteHandlerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/auth/guards', () => ({
  withOpsMutation: withOpsMutationMock,
}));

vi.mock('@/server/supabase', () => ({
  getRouteHandlerSupabaseClient: getRouteHandlerSupabaseClientMock,
}));

import { GET } from '@/src/app/api/config/merge-rules/route';

describe('merge rules config route', () => {
  beforeEach(() => {
    withOpsMutationMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockReset();
  });

  it('requires ops authentication before exposing merge policy', async () => {
    withOpsMutationMock.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
      }),
    });

    const response = await GET(new NextRequest('https://app.nabatable.com/api/config/merge-rules'));

    expect(response.status).toBe(401);
    expect(getRouteHandlerSupabaseClientMock).not.toHaveBeenCalled();
  });

  it('returns merge rules for authenticated ops users', async () => {
    withOpsMutationMock.mockResolvedValue({ ok: true });
    const orderFromB = vi.fn(async () => ({
      data: [
        {
          id: 'rule-1',
          from_a: 2,
          from_b: 2,
          to_capacity: 4,
          enabled: true,
          require_same_zone: true,
          require_adjacency: false,
          cross_category_merge: false,
        },
      ],
      error: null,
    }));
    const orderFromA = vi.fn(() => ({ order: orderFromB }));
    const select = vi.fn(() => ({ order: orderFromA }));
    getRouteHandlerSupabaseClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select })),
    });

    const response = await GET(new NextRequest('https://app.nabatable.com/api/config/merge-rules'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      rules: [
        {
          id: 'rule-1',
          from: [2, 2],
          toCapacity: 4,
          enabled: true,
          requireSameZone: true,
          requireAdjacency: false,
          crossCategoryMerge: false,
        },
      ],
    });
  });
});
