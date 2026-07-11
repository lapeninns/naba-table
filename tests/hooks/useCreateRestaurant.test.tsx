import { renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useCreateRestaurant } from '@/hooks/ops/useCreateRestaurant';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const input = { name: 'The Fox', slug: 'the-fox', timezone: 'Europe/London' };

describe('useCreateRestaurant', () => {
  it('@contract posts the payload and invalidates the restaurants cache on success', async () => {
    const created = { id: 'rest-1', ...input };
    vi.mocked(fetchJson).mockResolvedValue(created as never);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCreateRestaurant(), { wrapper });

    await expect(result.current.mutateAsync(input as never)).resolves.toEqual(created);

    expect(fetchJson).toHaveBeenCalledWith('/api/ops/restaurants', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.opsRestaurants.all });
  });

  it('@contract surfaces errors without invalidating caches', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Slug taken', status: 409, code: 'SLUG_CONFLICT' }),
    );

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(() => useCreateRestaurant(), { wrapper });

    await expect(result.current.mutateAsync(input as never)).rejects.toMatchObject({
      status: 409,
      code: 'SLUG_CONFLICT',
    });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
