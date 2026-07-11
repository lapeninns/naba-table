import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useOperatingHours, useUpdateOperatingHours } from '@/hooks/owner/useOperatingHours';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const hoursResponse = {
  restaurantId: 'rest-1',
  timezone: 'Europe/London',
  weekly: [{ dayOfWeek: 1, opensAt: '09:00', closesAt: '22:00', isClosed: false, notes: null }],
  overrides: [],
};

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe('useOperatingHours', () => {
  it('@contract stays disabled without a restaurant id', () => {
    const { result } = setup(() => useOperatingHours(null));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract fetches hours for the restaurant', async () => {
    vi.mocked(fetchJson).mockResolvedValue(hoursResponse as never);

    const { result } = setup(() => useOperatingHours('rest-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchJson).toHaveBeenCalledWith('/api/owner/restaurants/rest-1/hours');
    expect(result.current.data).toEqual(hoursResponse);
  });

  it('@contract surfaces fetch errors', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Nope', status: 500, code: 'INTERNAL' }),
    );

    const { result } = setup(() => useOperatingHours('rest-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateOperatingHours', () => {
  const input = {
    weekly: [{ dayOfWeek: 1, opensAt: '10:00', closesAt: '23:00', isClosed: false }],
    overrides: [],
  };

  it('@contract PUTs the payload and primes the hours cache with the response', async () => {
    vi.mocked(fetchJson).mockResolvedValue(hoursResponse as never);

    const { result, queryClient } = setup(() => useUpdateOperatingHours('rest-1'));

    await result.current.mutateAsync(input);

    expect(fetchJson).toHaveBeenCalledWith('/api/owner/restaurants/rest-1/hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(queryClient.getQueryData(queryKeys.ownerRestaurants.hours('rest-1'))).toEqual(
      hoursResponse,
    );
  });

  it('@contract rejects with MISSING_RESTAURANT before hitting the network when id is null', async () => {
    const { result } = setup(() => useUpdateOperatingHours(null));

    await expect(result.current.mutateAsync(input)).rejects.toMatchObject({
      status: 400,
      code: 'MISSING_RESTAURANT',
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
