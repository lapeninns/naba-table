import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@shared/api/client';
import { fetchRestaurantBySlug } from '@features/reservations/wizard/api/fetchRestaurantBySlug';

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(apiClient.get);

beforeEach(() => {
  getMock.mockReset();
});

describe('fetchRestaurantBySlug', () => {
  it('requests the slug-scoped endpoint and unwraps the restaurant @contract @smoke', async () => {
    const restaurant = {
      id: 'rest-1',
      slug: 'the-fox',
      name: 'The Fox',
      address: '1 High Street',
      phone: '',
      email: '',
      policy: '',
      timezone: 'Europe/London',
      logoUrl: null,
      googleMapUrl: null,
    };
    getMock.mockResolvedValue({ restaurant });

    const result = await fetchRestaurantBySlug('the-fox');

    expect(getMock).toHaveBeenCalledWith('/restaurants/the-fox', { signal: undefined });
    expect(result).toBe(restaurant);
  });

  it('forwards the abort signal @contract', async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue({ restaurant: { id: 'rest-1' } });

    await fetchRestaurantBySlug('the-fox', { signal: controller.signal });

    expect(getMock).toHaveBeenCalledWith('/restaurants/the-fox', { signal: controller.signal });
  });

  it('throws when the payload has no restaurant @contract', async () => {
    getMock.mockResolvedValue({});
    await expect(fetchRestaurantBySlug('ghost-venue')).rejects.toThrow('Restaurant not found');

    getMock.mockResolvedValue(null);
    await expect(fetchRestaurantBySlug('ghost-venue')).rejects.toThrow('Restaurant not found');
  });

  it('propagates transport errors untouched @contract', async () => {
    const failure = Object.assign(new Error('HTTP 500'), { status: 500 });
    getMock.mockRejectedValue(failure);

    await expect(fetchRestaurantBySlug('the-fox')).rejects.toBe(failure);
  });
});
