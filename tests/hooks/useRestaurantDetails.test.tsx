import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import {
  useRestaurantDetails,
  useUpdateRestaurantDetails,
} from '@/hooks/owner/useRestaurantDetails';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const details = {
  restaurantId: 'rest-1',
  name: 'The Fox',
  slug: 'the-fox',
  timezone: 'Europe/London',
  capacity: 40,
  contactEmail: 'fox@example.com',
  contactPhone: '+441234567890',
  address: '1 Fox Lane',
  bookingPolicy: null,
  logoUrl: null,
};

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe('useRestaurantDetails', () => {
  it('@contract stays disabled without a restaurant id', () => {
    const { result } = setup(() => useRestaurantDetails(null));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract fetches details for the restaurant', async () => {
    vi.mocked(fetchJson).mockResolvedValue(details as never);

    const { result } = setup(() => useRestaurantDetails('rest-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchJson).toHaveBeenCalledWith('/api/owner/restaurants/rest-1/details');
    expect(result.current.data).toEqual(details);
  });

  it('@contract surfaces fetch errors', async () => {
    vi.mocked(fetchJson).mockRejectedValue(
      new HttpError({ message: 'Denied', status: 403, code: 'FORBIDDEN' }),
    );

    const { result } = setup(() => useRestaurantDetails('rest-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRestaurantDetails', () => {
  it('@contract maps contact fields onto the API payload and defaults omitted fields to null', async () => {
    vi.mocked(fetchJson).mockResolvedValue(details as never);

    const { result, queryClient } = setup(() => useUpdateRestaurantDetails('rest-1'));

    await result.current.mutateAsync({
      name: 'The Fox',
      slug: 'the-fox',
      timezone: 'Europe/London',
      contactEmail: 'fox@example.com',
      contactPhone: '+441234567890',
    });

    const [url, init] = vi.mocked(fetchJson).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/owner/restaurants/rest-1/details');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'The Fox',
      slug: 'the-fox',
      timezone: 'Europe/London',
      capacity: null,
      phone: '+441234567890',
      email: 'fox@example.com',
      address: null,
      bookingPolicy: null,
      logoUrl: null,
    });
    expect(queryClient.getQueryData(queryKeys.ownerRestaurants.details('rest-1'))).toEqual(
      details,
    );
  });

  it('@contract rejects with MISSING_RESTAURANT before hitting the network when id is null', async () => {
    const { result } = setup(() => useUpdateRestaurantDetails(null));

    await expect(
      result.current.mutateAsync({ name: 'X', slug: 'x', timezone: 'UTC' }),
    ).rejects.toMatchObject({ status: 400, code: 'MISSING_RESTAURANT' });
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
