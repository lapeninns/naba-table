import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchJson } from '@/lib/http/fetchJson';
import { createBrowserBookingService } from '@/services/ops/bookings';

vi.mock('@/lib/http/fetchJson', () => ({
  fetchJson: vi.fn(),
}));

const fetchJsonMock = vi.mocked(fetchJson);

describe('createBrowserBookingService', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('includes query parameter when provided', async () => {
    const service = createBrowserBookingService();
    fetchJsonMock.mockResolvedValue({} as unknown);

    await service.listBookings({ restaurantId: 'rest-1', page: 1, pageSize: 10, query: 'Alex' });

    expect(fetchJsonMock).toHaveBeenCalledWith(expect.stringContaining('query=Alex'), expect.any(Object));
  });

  it('omits empty query values', async () => {
    const service = createBrowserBookingService();
    fetchJsonMock.mockResolvedValue({} as unknown);

    await service.listBookings({ restaurantId: 'rest-1', page: 1, pageSize: 10, query: '' });

    const [url] = fetchJsonMock.mock.calls[0] ?? [];
    expect(url).toBeDefined();
    expect(String(url)).not.toContain('query=');
  });
});
