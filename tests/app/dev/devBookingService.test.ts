import { describe, expect, it } from 'vitest';

import { DEV_BOOKING_ID, DEV_RESTAURANT_ID } from '@/src/app/(public)/dev/_mocks/devIds';
import { createDevBookingService } from '@/src/app/(public)/dev/_mocks/services/devBookingService';

describe('development booking service contract', () => {
  it('filters, pages, and resolves seeded bookings', async () => {
    const service = createDevBookingService();
    const page = await service.listBookings({
      restaurantId: DEV_RESTAURANT_ID,
      page: 1,
      pageSize: 2,
      sort: 'asc',
      sortBy: 'start_at',
    });

    expect(page.items).toHaveLength(2);
    expect(page.pageInfo.total).toBeGreaterThan(2);
    await expect(service.getBooking(DEV_BOOKING_ID)).resolves.toMatchObject({
      id: DEV_BOOKING_ID,
      restaurantId: DEV_RESTAURANT_ID,
    });
  });

  it('shares lifecycle and assignment state across extracted modules', async () => {
    const service = createDevBookingService();
    await expect(
      service.checkInBooking({ id: DEV_BOOKING_ID, performedAt: '2026-07-15T12:00:00.000Z' }),
    ).resolves.toMatchObject({ status: 'checked_in' });
    await expect(
      service.checkOutBooking({ id: DEV_BOOKING_ID, performedAt: '2026-07-15T14:00:00.000Z' }),
    ).resolves.toMatchObject({ status: 'completed' });

    await service.assignTablesDirect({
      bookingId: DEV_BOOKING_ID,
      tableIds: ['t-12'],
    });
    await expect(service.getAssignmentContext(DEV_BOOKING_ID)).resolves.toMatchObject({
      bookingAssignments: ['t-12'],
    });
  });

  it('preserves delivery feeds and stable unsupported-method errors', async () => {
    const service = createDevBookingService();
    await expect(service.getBookingEmailDeliveryLog(DEV_BOOKING_ID)).resolves.toMatchObject({
      ok: true,
      bookingId: DEV_BOOKING_ID,
    });
    await expect(
      service.getRestaurantEmailQueue({ restaurantId: DEV_RESTAURANT_ID }),
    ).resolves.toMatchObject({ ok: true, restaurantId: DEV_RESTAURANT_ID });
    await expect(service.getTodaySummary({ restaurantId: DEV_RESTAURANT_ID })).rejects.toThrow(
      '[dev][bookingService] getTodaySummary is not implemented',
    );
  });
});
