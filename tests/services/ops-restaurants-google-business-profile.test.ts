import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJsonMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: fetchJsonMock,
}));

import { createBrowserRestaurantService } from '@/services/ops/restaurants';

describe('browser restaurant service Google Business Profile details', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchJsonMock.mockResolvedValue({ status: 'linked' });
  });

  it('loads the rich legacy connection DTO from the dedicated details endpoint', async () => {
    const service = createBrowserRestaurantService();

    await service.getGoogleBusinessProfileConnection('restaurant-1');

    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/ops/restaurants/restaurant-1/google-business-profile/details',
      undefined,
    );
  });

  it('loads available locations through the canonical profile route', async () => {
    fetchJsonMock.mockResolvedValueOnce({ locations: [] });
    const service = createBrowserRestaurantService();

    const locations = await service.getGoogleBusinessProfileAvailableLocations('restaurant-1');

    expect(locations).toEqual([]);
    expect(fetchJsonMock).toHaveBeenCalledWith(
      '/api/ops/restaurants/restaurant-1/google-business-profile/locations',
      undefined,
    );
  });
});
