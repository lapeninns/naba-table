import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useRestaurants } from '@/hooks/ops/useRestaurants';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const list = { items: [], pageInfo: { page: 1, pageSize: 10, total: 0, hasNext: false } };

function setup(filters: Parameters<typeof useRestaurants>[0]) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return renderHook(() => useRestaurants(filters), { wrapper });
}

describe('useRestaurants', () => {
  it('@contract requests the unfiltered list when no filters are set', async () => {
    vi.mocked(fetchJson).mockResolvedValue(list as never);

    const { result } = setup({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchJson).toHaveBeenCalledWith('/api/ops/restaurants?');
    expect(result.current.data).toEqual(list);
  });

  it('@contract serialises only the provided filters', async () => {
    vi.mocked(fetchJson).mockResolvedValue(list as never);

    const { result } = setup({ page: 2, pageSize: 5, search: 'fox', sort: 'name' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(fetchJson).mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('5');
    expect(params.get('search')).toBe('fox');
    expect(params.get('sort')).toBe('name');
  });

  it('@contract surfaces request failures', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Server down', status: 500, code: 'INTERNAL' }),
    );

    const { result } = setup({});

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
