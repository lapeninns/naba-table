import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useRestaurantMemberships } from '@/hooks/owner/useRestaurantMemberships';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const membership = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  role: 'owner',
  restaurant: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'The Fox',
    slug: 'the-fox',
  },
};

function setup() {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useRestaurantMemberships(), { wrapper });
}

describe('useRestaurantMemberships', () => {
  it('@contract parses the response and unwraps the memberships array', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ memberships: [membership] } as never);

    const { result } = setup();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchJson).toHaveBeenCalledWith('/api/ops/team/memberships');
    expect(result.current.data).toEqual([membership]);
  });

  it('@contract rejects payloads that fail schema validation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      memberships: [{ restaurantId: 'not-a-uuid', role: 'owner' }],
    } as never);

    const { result } = setup();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('@contract surfaces http errors', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' }),
    );

    const { result } = setup();

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
