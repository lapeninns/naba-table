import { describe, expect, it, vi } from 'vitest';

import { reservationListAdapter } from '@entities/reservation/adapter';
import { fetchBookingsByContact } from '@features/reservations/wizard/api/fetchBookingsByContact';
import { apiClient } from '@shared/api/client';

vi.mock('@shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('@entities/reservation/adapter', () => ({
  reservationListAdapter: vi.fn(),
}));

describe('fetchBookingsByContact', () => {
  it('requests contact bookings and adapts the response', async () => {
    const booking = { id: 'booking-1' };
    const adapted = [{ id: 'booking-1' }];

    vi.mocked(apiClient.get).mockResolvedValue({ bookings: [booking] });
    vi.mocked(reservationListAdapter).mockReturnValue(adapted as never);

    const result = await fetchBookingsByContact({
      restaurantId: 'rest-1',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/bookings?email=guest%40example.com&phone=%2B441234567890&restaurantId=rest-1',
    );
    expect(reservationListAdapter).toHaveBeenCalledWith([booking]);
    expect(result).toEqual(adapted);
  });

  it('handles empty booking responses', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({});
    vi.mocked(reservationListAdapter).mockReturnValue([] as never);

    const result = await fetchBookingsByContact({
      restaurantId: '',
      email: 'guest@example.com',
      phone: '+441234567890',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/bookings?email=guest%40example.com&phone=%2B441234567890',
    );
    expect(reservationListAdapter).toHaveBeenCalledWith([]);
    expect(result).toEqual([]);
  });
});
