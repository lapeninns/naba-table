import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import { useServicePeriods, useUpdateServicePeriods } from '@/hooks/owner/useServicePeriods';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const periods = [
  {
    id: 'period-1',
    name: 'Dinner',
    dayOfWeek: 5,
    startTime: '18:00',
    endTime: '22:00',
    bookingOption: 'dinner',
  },
];

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe('useServicePeriods', () => {
  it('@contract stays disabled without a restaurant id', () => {
    const { result } = setup(() => useServicePeriods(null));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract unwraps the periods array from the response envelope', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ restaurantId: 'rest-1', periods } as never);

    const { result } = setup(() => useServicePeriods('rest-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchJson).toHaveBeenCalledWith('/api/owner/restaurants/rest-1/service-periods');
    expect(result.current.data).toEqual(periods);
  });

  it('@contract surfaces fetch errors', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Broken', status: 500, code: 'INTERNAL' }),
    );

    const { result } = setup(() => useServicePeriods('rest-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateServicePeriods', () => {
  it('@contract PUTs the payload and primes the periods cache with the response', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ restaurantId: 'rest-1', periods } as never);

    const { result, queryClient } = setup(() => useUpdateServicePeriods('rest-1'));

    const payload = [
      { name: 'Dinner', startTime: '18:00', endTime: '22:00', bookingOption: 'dinner' as const },
    ];
    await expect(result.current.mutateAsync(payload as never)).resolves.toEqual(periods);

    expect(fetchJson).toHaveBeenCalledWith('/api/owner/restaurants/rest-1/service-periods', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(
      queryClient.getQueryData(queryKeys.ownerRestaurants.servicePeriods('rest-1')),
    ).toEqual(periods);
  });

  it('@contract rejects with MISSING_RESTAURANT before hitting the network when id is null', async () => {
    const { result } = setup(() => useUpdateServicePeriods(null));

    await expect(result.current.mutateAsync([] as never)).rejects.toMatchObject({
      status: 400,
      code: 'MISSING_RESTAURANT',
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
