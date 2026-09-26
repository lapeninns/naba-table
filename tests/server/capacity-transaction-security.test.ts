import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBookingWithCapacityCheck,
  updateBookingWithCapacityCheck,
} from '@/server/capacity/transaction';

import type { CreateBookingParams, UpdateBookingParams } from '@/server/capacity/types';

const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/runtime-policy', () => ({
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
  it('records a key hash, never the raw idempotency key, on the creation attempt', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { success: false, error: 'CAPACITY_EXCEEDED', message: 'full' },
      error: null,
    });

    await createBookingWithCapacityCheck(bookingParams, { rpc } as never);

    const attempt = recordObservabilityEventMock.mock.calls
      .map(([event]) => event as { eventType: string; context: Record<string, unknown> })
      .find((event) => event.eventType === 'booking.creation.attempt');
    expect(attempt?.context.keyHash).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(recordObservabilityEventMock.mock.calls)).not.toContain(
      bookingParams.idempotencyKey,
    );
  });

  it('records only the SQLSTATE and a redacted message for an RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key for alex@example.com',
        details: 'Key (customer_email)=(alex@example.com) already exists. SECRET_DB_DETAIL',
      },
    });

    await expect(createBookingWithCapacityCheck(bookingParams, { rpc } as never)).rejects.toThrow();

    const rpcError = recordObservabilityEventMock.mock.calls
      .map(([event]) => event as { eventType: string; context: Record<string, unknown> })
      .find((event) => event.eventType === 'booking.creation.rpc_error');
    expect(rpcError?.context).toMatchObject({ errorCode: '23505' });
    expect(rpcError?.context).not.toHaveProperty('details');
    expect(rpcError?.context).not.toHaveProperty('error');
    const serialized = JSON.stringify(recordObservabilityEventMock.mock.calls);
    expect(serialized).not.toContain('alex@example.com');
    expect(serialized).not.toContain('SECRET_DB_DETAIL');
  });

  const internalErrorPayload = {
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'Unexpected error: value alex@example.com violates SECRET_DB_DETAIL',
    details: {
      sqlstate: '23514',
      sqlerrm: 'new row for alex@example.com violates check constraint SECRET_DB_DETAIL',
      timezone: 'Europe/London',
      availableCovers: 3,
    },
  };

  function failureEvent(eventType: string) {
    return recordObservabilityEventMock.mock.calls
      .map(([event]) => event as { eventType: string; context: Record<string, unknown> })
      .find((event) => event.eventType === eventType);
  }

  it('never records raw RPC message or sqlerrm on a creation failure', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: internalErrorPayload, error: null });

    await createBookingWithCapacityCheck(bookingParams, { rpc } as never);

    const failure = failureEvent('booking.creation.failure');
    expect(failure?.context).toMatchObject({
      error: 'INTERNAL_ERROR',
      details: { availableCovers: 3, timezone: 'Europe/London' },
    });
    expect(failure?.context).not.toHaveProperty('message');
    const serialized = JSON.stringify(recordObservabilityEventMock.mock.calls);
    expect(serialized).not.toContain('alex@example.com');
    expect(serialized).not.toContain('SECRET_DB_DETAIL');
    expect(serialized).not.toContain('sqlerrm');
  });

  it('never records raw RPC message or sqlerrm on an update failure', async () => {
    const updateParams: UpdateBookingParams = {
      bookingId: '33333333-3333-4333-8333-333333333333',
      restaurantId: bookingParams.restaurantId,
      customerId: bookingParams.customerId,
      bookingDate: bookingParams.bookingDate,
      startTime: bookingParams.startTime,
      endTime: bookingParams.endTime,
      partySize: bookingParams.partySize,
      bookingType: bookingParams.bookingType,
      customerName: bookingParams.customerName,
      customerEmail: bookingParams.customerEmail,
      customerPhone: bookingParams.customerPhone,
      seatingPreference: bookingParams.seatingPreference,
    };
    const rpc = vi.fn().mockResolvedValue({ data: internalErrorPayload, error: null });

    await updateBookingWithCapacityCheck(updateParams, { rpc } as never);

    const failure = failureEvent('booking.update.failure');
    expect(failure?.context).toMatchObject({ error: 'INTERNAL_ERROR' });
    expect(failure?.context).not.toHaveProperty('message');
    const serialized = JSON.stringify(recordObservabilityEventMock.mock.calls);
    expect(serialized).not.toContain('alex@example.com');
    expect(serialized).not.toContain('SECRET_DB_DETAIL');
    expect(serialized).not.toContain('sqlerrm');
  });
});
