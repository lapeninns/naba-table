import { describe, expect, it, vi } from 'vitest';

const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { fetchUserMembershipsCached, requireMembershipForRestaurant } from '@/server/team/access';

const USER_ID = 'user-cache-test';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function membershipRow(role: string) {
  return {
    id: `membership-${role}`,
    user_id: USER_ID,
    restaurant_id: RESTAURANT_ID,
    role,
    created_at: '2026-05-16T00:00:00.000Z',
    updated_at: '2026-05-16T00:00:00.000Z',
    restaurants: { id: RESTAURANT_ID, name: 'Test', slug: 'test' },
  };
}

function listClient(rows: unknown[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject),
  };

  return {
    from: vi.fn(() => builder),
  };
}

function singleClient(row: unknown | null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };

  return {
    from: vi.fn(() => builder),
  };
}

describe('team access membership cache', () => {
  it('does not use the layout membership cache for authorization by default', async () => {
    getServiceSupabaseClientMock.mockReturnValue(listClient([membershipRow('owner')]));
    await expect(fetchUserMembershipsCached(USER_ID)).resolves.toHaveLength(1);

    await expect(
      requireMembershipForRestaurant({
        userId: USER_ID,
        restaurantId: RESTAURANT_ID,
        client: singleClient(null) as never,
      }),
    ).rejects.toMatchObject({
      code: 'MEMBERSHIP_NOT_FOUND',
    });
  });
});
