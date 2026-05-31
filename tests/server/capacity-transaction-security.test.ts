import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBookingWithCapacityCheck } from '@/server/capacity/transaction';

import type { CreateBookingParams } from '@/server/capacity/types';

const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/feature-flags', () => ({
  isAllocatorServiceFailHard: vi.fn(() => true),
}));

const bookingParams: CreateBookingParams = {
  restaurantId: '11111111-1111-4111-8111-111111111111',
  customerId: '22222222-2222-4222-8222-222222222222',
  bookingDate: '2026-07-01',
  startTime: '19:00',
  endTime: '20:30',
  partySize: 4,
  bookingType: 'dinner',
  customerName: 'Alex Guest',
  customerEmail: 'alex@example.com',
  customerPhone: '+447700900123',
  seatingPreference: 'no_preference',
  notes: 'Window seat please',
  marketingOptIn: true,
  idempotencyKey: 'public-booking-idempotency-key',
  source: 'api',
  authUserId: null,
  clientRequestId: 'client-request-1',
  details: { occasion: 'birthday' },
};

describe('capacity transaction security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    recordObservabilityEventMock.mockReset();
  });

  it('does not console-log full booking RPC payloads containing guest PII', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({
      data: {
        success: true,
        duplicate: false,
        booking: {
          id: 'booking-1',
          restaurant_id: bookingParams.restaurantId,
          customer_id: bookingParams.customerId,
          booking_date: bookingParams.bookingDate,
          start_time: bookingParams.startTime,
          end_time: bookingParams.endTime,
          start_at: null,
          end_at: null,
          party_size: bookingParams.partySize,
          booking_type: bookingParams.bookingType,
          seating_preference: bookingParams.seatingPreference,
          status: 'confirmed',
          reference: 'ABC123',
          customer_name: bookingParams.customerName,
          customer_email: bookingParams.customerEmail,
          customer_phone: bookingParams.customerPhone,
          notes: bookingParams.notes,
          marketing_opt_in: true,
          loyalty_points_awarded: 0,
          source: 'api',
          auth_user_id: null,
          idempotency_key: bookingParams.idempotencyKey,
          details: bookingParams.details,
          created_at: '2026-05-30T22:00:00.000Z',
          updated_at: '2026-05-30T22:00:00.000Z',
        },
        capacity: {
          maxCovers: 20,
          bookedCovers: 4,
          availableCovers: 16,
          utilizationPercent: 20,
        },
      },
      error: null,
    });

    const result = await createBookingWithCapacityCheck(bookingParams, { rpc } as never);

    expect(result.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'create_booking_with_capacity_check',
      expect.objectContaining({
        p_customer_email: bookingParams.customerEmail,
        p_customer_phone: bookingParams.customerPhone,
        p_idempotency_key: bookingParams.idempotencyKey,
      }),
    );
    expect(consoleLog).not.toHaveBeenCalled();
  });
});
