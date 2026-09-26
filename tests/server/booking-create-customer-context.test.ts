import { describe, expect, it, vi } from 'vitest';

import {
  resolveBookingCreateCustomerContext,
  type BookingCreateCustomerUpserter,
  type BookingCreateIdempotencyKeyBuilder,
} from '@/server/bookings/create-customer-context';

type BookingCreateCustomerClient = Parameters<BookingCreateCustomerUpserter>[0];
type BookingCreateCustomer = Awaited<ReturnType<BookingCreateCustomerUpserter>>;

const client = { from: vi.fn() } as unknown as BookingCreateCustomerClient;
const customer = { id: 'customer-1' } as BookingCreateCustomer;

describe('resolveBookingCreateCustomerContext', () => {
  it('upserts customers with strict public booking identity options', async () => {
    const customerUpserter = vi.fn(async () => customer);
    const idempotencyKeyBuilder = vi.fn(() => 'deterministic-key');

    await expect(
      resolveBookingCreateCustomerContext({
        client,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '07123456789',
        name: 'Guest Name',
        marketingOptIn: true,
        bookingDate: '2026-07-01',
        startTime: '19:00',
        endTime: '20:30',
        partySize: 2,
        bookingType: 'dinner',
        seatingPreference: 'any',
        notes: null,
        customerUpserter: customerUpserter as BookingCreateCustomerUpserter,
        idempotencyKeyBuilder: idempotencyKeyBuilder as BookingCreateIdempotencyKeyBuilder,
      }),
    ).resolves.toEqual({
      customer,
      deterministicIdempotencyKey: 'deterministic-key',
      idempotencyKey: 'deterministic-key',
    });

    expect(customerUpserter).toHaveBeenCalledWith(client, {
      restaurantId: 'restaurant-1',
      email: 'guest@example.com',
      phone: '07123456789',
      name: 'Guest Name',
      marketingOptIn: true,
      identityMatchMode: 'strict',
      allowExistingUpdates: false,
    });
  });

  it('builds deterministic idempotency keys from the resolved customer', async () => {
    const customerUpserter = vi.fn(async () => customer);
    const idempotencyKeyBuilder = vi.fn(() => 'deterministic-key');

    await resolveBookingCreateCustomerContext({
      client,
      restaurantId: 'restaurant-1',
      email: 'guest@example.com',
      phone: '07123456789',
      name: 'Guest Name',
      bookingDate: '2026-07-01',
      startTime: '19:00',
      endTime: '20:30',
      partySize: 2,
      bookingType: 'dinner',
      seatingPreference: 'any',
      notes: ' Birthday ',
      customerUpserter: customerUpserter as BookingCreateCustomerUpserter,
      idempotencyKeyBuilder: idempotencyKeyBuilder as BookingCreateIdempotencyKeyBuilder,
    });

    expect(idempotencyKeyBuilder).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      bookingDate: '2026-07-01',
      startTime: '19:00',
      endTime: '20:30',
      partySize: 2,
      bookingType: 'dinner',
      seatingPreference: 'any',
      notes: ' Birthday ',
    });
  });

  it('prefers an explicit request idempotency key over the deterministic fallback', async () => {
    const customerUpserter = vi.fn(async () => customer);
    const idempotencyKeyBuilder = vi.fn(() => 'deterministic-key');

    await expect(
      resolveBookingCreateCustomerContext({
        client,
        restaurantId: 'restaurant-1',
        email: 'guest@example.com',
        phone: '07123456789',
        name: 'Guest Name',
        marketingOptIn: null,
        bookingDate: '2026-07-01',
        startTime: '19:00',
        endTime: '20:30',
        partySize: 2,
        bookingType: 'dinner',
        seatingPreference: 'any',
        notes: null,
        headerIdempotencyKey: 'request-key',
        customerUpserter: customerUpserter as BookingCreateCustomerUpserter,
        idempotencyKeyBuilder: idempotencyKeyBuilder as BookingCreateIdempotencyKeyBuilder,
      }),
    ).resolves.toEqual({
      customer,
      deterministicIdempotencyKey: 'deterministic-key',
      idempotencyKey: 'request-key',
    });

    expect(customerUpserter).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ marketingOptIn: false }),
    );
  });
});
