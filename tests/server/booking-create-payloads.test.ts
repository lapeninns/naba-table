import { describe, expect, it, vi } from 'vitest';

import {
  buildFallbackInsertBookingPayload,
  buildBookingCreatedAuditEvent,
  buildBookingCreatedAuditMetadata,
  buildBookingInitialStatusEnforcement,
  buildBookingValidationCreatePayload,
  buildCapacityCreateBookingParams,
  dispatchBookingCreatedAuditEvent,
  enforceBookingCreateInitialStatus,
  type BookingCreatePayloadBase,
} from '@/server/bookings/create-payloads';

import type { BookingRecord } from '@/server/bookings';
import type {
  BookingCreatedAuditLogger,
  BookingInitialStatusUpdater,
} from '@/server/bookings/create-payloads';

const baseParams: BookingCreatePayloadBase = {
  request: {
    restaurantId: '11111111-1111-4111-8111-111111111111',
    restaurantSlug: 'old-crown',
    date: '2026-05-23',
    time: '18:00',
    party: 4,
    bookingType: 'dinner',
    notes: undefined,
    name: 'Ada Lovelace',
    email: ' Ada@Example.COM ',
    phone: ' 07123456789 ',
    marketingOptIn: undefined,
  },
  customer: { id: 'customer-1' },
  restaurantId: 'restaurant-1',
  bookingType: 'dinner',
  startTime: '18:30',
  endTime: '20:00',
  durationMinutes: 90,
  idempotencyKey: 'idem-1',
  bookingSource: 'ops.walkin',
  clientRequestId: 'request-1',
  bookingDetails: {
    channel: 'ops.walkin',
    created_by: 'ops.walkin',
    staff_request_id: 'request-1',
  },
};

describe('booking create payload builders', () => {
  it('builds unified validation input and context from request/customer data', () => {
    expect(
      buildBookingValidationCreatePayload({
        ...baseParams,
        scheduleTimezone: null,
        pastTimeBlocking: true,
        pastTimeGraceMinutes: 7,
      }),
    ).toEqual({
      input: {
        restaurantId: 'restaurant-1',
        serviceId: 'dinner',
        bookingType: 'dinner',
        partySize: 4,
        start: '2026-05-23T18:30:00',
        durationMinutes: 90,
        notes: null,
        customerId: 'customer-1',
        customerName: 'Ada Lovelace',
        customerEmail: 'ada@example.com',
        customerPhone: '07123456789',
        marketingOptIn: false,
        source: 'ops.walkin',
        idempotencyKey: 'idem-1',
        details: baseParams.bookingDetails,
      },
      context: {
        actorId: 'request-1',
        actorRoles: ['customer'],
        actorCapabilities: [],
        tz: 'Europe/London',
        flags: {
          bookingPastTimeBlocking: true,
          bookingPastTimeGraceMinutes: 7,
          unified: true,
        },
        metadata: {
          clientRequestId: 'request-1',
        },
      },
    });
  });

  it('preserves notes, marketing opt-in, and explicit schedule timezone', () => {
    expect(
      buildBookingValidationCreatePayload({
        ...baseParams,
        request: {
          ...baseParams.request,
          notes: 'Anniversary',
          marketingOptIn: true,
        },
        scheduleTimezone: 'Europe/Paris',
        pastTimeBlocking: false,
        pastTimeGraceMinutes: 5,
      }),
    ).toMatchObject({
      input: {
        notes: 'Anniversary',
        marketingOptIn: true,
      },
      context: {
        tz: 'Europe/Paris',
        flags: {
          bookingPastTimeBlocking: false,
          bookingPastTimeGraceMinutes: 5,
          unified: true,
        },
      },
    });
  });

  it('builds capacity create params with route-equivalent defaults', () => {
    expect(buildCapacityCreateBookingParams(baseParams)).toEqual({
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      bookingDate: '2026-05-23',
      startTime: '18:30',
      endTime: '20:00',
      partySize: 4,
      bookingType: 'dinner',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerPhone: '07123456789',
      seatingPreference: 'any',
      notes: null,
      marketingOptIn: false,
      idempotencyKey: 'idem-1',
      source: 'ops.walkin',
      authUserId: null,
      clientRequestId: 'request-1',
      details: baseParams.bookingDetails,
    });
  });

  it('builds fallback insert payloads with route-equivalent values', () => {
    expect(
      buildFallbackInsertBookingPayload({
        ...baseParams,
        reference: 'REF123',
      }),
    ).toEqual({
      restaurant_id: 'restaurant-1',
      customer_id: 'customer-1',
      booking_date: '2026-05-23',
      start_time: '18:30',
      end_time: '20:00',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      reference: 'REF123',
      customer_name: 'Ada Lovelace',
      customer_email: 'ada@example.com',
      customer_phone: '07123456789',
      notes: null,
      marketing_opt_in: false,
      loyalty_points_awarded: 0,
      source: 'api',
      client_request_id: 'request-1',
      idempotency_key: 'idem-1',
      details: { fallback: 'missing_rpc_booking_record' },
    });
  });

  it('preserves nullable fallback fields when explicit values are provided', () => {
    expect(
      buildFallbackInsertBookingPayload({
        ...baseParams,
        request: {
          ...baseParams.request,
          notes: 'Quiet table',
          marketingOptIn: true,
        },
        idempotencyKey: null,
        reference: 'REF456',
      }),
    ).toMatchObject({
      notes: 'Quiet table',
      marketing_opt_in: true,
      idempotency_key: null,
    });
  });

  it('builds created booking audit metadata with the booking snapshot', () => {
    const booking = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      customer_id: 'customer-1',
      booking_date: '2026-05-23',
      start_time: '18:30',
      end_time: '20:00',
      reference: 'REF123',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      customer_name: 'Ada Lovelace',
      customer_email: 'ada@example.com',
      customer_phone: '07123456789',
      notes: null,
      marketing_opt_in: false,
      source: 'api',
      client_request_id: 'request-1',
      idempotency_key: 'idem-1',
      details: { channel: 'api' },
    } as BookingRecord;

    const metadata = buildBookingCreatedAuditMetadata({
      restaurantId: 'restaurant-1',
      customer: { id: 'customer-1' },
      booking,
    });

    expect(metadata).toMatchObject({
      restaurant_id: 'restaurant-1',
      customer_id: 'customer-1',
      reference: 'REF123',
      previous: null,
      current: {
        restaurant_id: 'restaurant-1',
        customer_id: 'customer-1',
        booking_date: '2026-05-23',
        start_time: '18:30',
        end_time: '20:00',
        reference: 'REF123',
        party_size: 4,
        booking_type: 'dinner',
        seating_preference: 'any',
        status: 'pending',
        customer_name: 'Ada Lovelace',
        customer_email: 'ada@example.com',
        customer_phone: '07123456789',
        notes: null,
        marketing_opt_in: false,
        source: 'api',
        client_request_id: 'request-1',
        idempotency_key: 'idem-1',
        details: { channel: 'api' },
      },
    });
    expect(metadata).toHaveProperty('changes');
    expect((metadata as { changes: Array<{ field: string }> }).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'restaurant_id', before: null, after: 'restaurant-1' }),
        expect.objectContaining({ field: 'reference', before: null, after: 'REF123' }),
      ]),
    );
  });
});

describe('buildBookingCreatedAuditEvent', () => {
  it('builds the booking-created audit event envelope with metadata', () => {
    const booking = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      customer_id: 'customer-1',
      booking_date: '2026-05-23',
      start_time: '18:30',
      end_time: '20:00',
      reference: 'REF123',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      customer_name: 'Ada Lovelace',
      customer_email: 'ada@example.com',
      customer_phone: '07123456789',
      notes: null,
      marketing_opt_in: false,
      source: 'api',
      client_request_id: 'request-1',
      idempotency_key: 'idem-1',
      details: { channel: 'api' },
    } as BookingRecord;

    const event = buildBookingCreatedAuditEvent({
      restaurantId: 'restaurant-1',
      customer: { id: 'customer-1' },
      booking,
      actor: 'ada@example.com',
    });

    expect(event).toMatchObject({
      action: 'booking.created',
      entity: 'booking',
      entityId: 'booking-1',
      actor: 'ada@example.com',
      metadata: {
        restaurant_id: 'restaurant-1',
        customer_id: 'customer-1',
        reference: 'REF123',
      },
    });
    expect(event.metadata).toHaveProperty('current');
    expect(event.metadata).toHaveProperty('changes');
  });

  it('dispatches the booking-created audit event through the provided logger', async () => {
    const booking = {
      id: 'booking-1',
      restaurant_id: 'restaurant-1',
      customer_id: 'customer-1',
      booking_date: '2026-05-23',
      start_time: '18:30',
      end_time: '20:00',
      reference: 'REF123',
      party_size: 4,
      booking_type: 'dinner',
      seating_preference: 'any',
      status: 'pending',
      customer_name: 'Ada Lovelace',
      customer_email: 'ada@example.com',
      customer_phone: '07123456789',
      notes: null,
      marketing_opt_in: false,
      source: 'api',
      client_request_id: 'request-1',
      idempotency_key: 'idem-1',
      details: { channel: 'api' },
    } as BookingRecord;
    const client = {};
    const logger = vi.fn<BookingCreatedAuditLogger>(async () => undefined);

    await dispatchBookingCreatedAuditEvent({
      actor: 'ada@example.com',
      booking,
      client: client as Parameters<BookingCreatedAuditLogger>[0],
      customer: { id: 'customer-1' },
      logger,
      restaurantId: 'restaurant-1',
    });

    expect(logger).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        action: 'booking.created',
        entity: 'booking',
        entityId: 'booking-1',
        actor: 'ada@example.com',
        metadata: expect.objectContaining({
          restaurant_id: 'restaurant-1',
          customer_id: 'customer-1',
          reference: 'REF123',
        }),
      }),
    );
  });

  it('propagates booking-created audit logger failures', async () => {
    const loggerError = new Error('audit unavailable');
    const logger = vi.fn<BookingCreatedAuditLogger>(async () => {
      throw loggerError;
    });

    await expect(
      dispatchBookingCreatedAuditEvent({
        actor: 'ada@example.com',
        booking: { id: 'booking-1', reference: 'REF123' } as BookingRecord,
        client: {} as Parameters<BookingCreatedAuditLogger>[0],
        customer: { id: 'customer-1' },
        logger,
        restaurantId: 'restaurant-1',
      }),
    ).rejects.toThrow(loggerError);
  });
});

describe('buildBookingInitialStatusEnforcement', () => {
  it('does not enforce status for reused bookings', () => {
    expect(
      buildBookingInitialStatusEnforcement({
        booking: { id: 'booking-1', status: 'confirmed' } as BookingRecord,
        reusedExisting: true,
      }),
    ).toBeNull();
  });

  it('does not enforce status for new bookings that are already pending', () => {
    expect(
      buildBookingInitialStatusEnforcement({
        booking: { id: 'booking-1', status: 'pending' } as BookingRecord,
        reusedExisting: false,
      }),
    ).toBeNull();
  });

  it('builds the pending status update payload for non-pending new bookings', () => {
    expect(
      buildBookingInitialStatusEnforcement({
        booking: { id: 'booking-1', status: 'confirmed' } as BookingRecord,
        reusedExisting: false,
      }),
    ).toEqual({
      bookingId: 'booking-1',
      payload: { status: 'pending' },
    });
  });

  it('does not call the updater for reused bookings', async () => {
    const booking = { id: 'booking-1', status: 'confirmed' } as BookingRecord;
    const updater = vi.fn<BookingInitialStatusUpdater>(async () => {
      throw new Error('should not update');
    });

    await expect(
      enforceBookingCreateInitialStatus({
        booking,
        client: {} as Parameters<BookingInitialStatusUpdater>[0],
        reusedExisting: true,
        updater,
      }),
    ).resolves.toBe(booking);

    expect(updater).not.toHaveBeenCalled();
  });

  it('does not call the updater for new bookings that are already pending', async () => {
    const booking = { id: 'booking-1', status: 'pending' } as BookingRecord;
    const updater = vi.fn<BookingInitialStatusUpdater>(async () => {
      throw new Error('should not update');
    });

    await expect(
      enforceBookingCreateInitialStatus({
        booking,
        client: {} as Parameters<BookingInitialStatusUpdater>[0],
        reusedExisting: false,
        updater,
      }),
    ).resolves.toBe(booking);

    expect(updater).not.toHaveBeenCalled();
  });

  it('returns the updated booking when initial status enforcement succeeds', async () => {
    const booking = { id: 'booking-1', status: 'confirmed' } as BookingRecord;
    const updatedBooking = { id: 'booking-1', status: 'pending' } as BookingRecord;
    const client = {};
    const updater = vi.fn<BookingInitialStatusUpdater>(async () => updatedBooking);

    await expect(
      enforceBookingCreateInitialStatus({
        booking,
        client: client as Parameters<BookingInitialStatusUpdater>[0],
        reusedExisting: false,
        updater,
      }),
    ).resolves.toBe(updatedBooking);

    expect(updater).toHaveBeenCalledWith(client, 'booking-1', { status: 'pending' });
  });

  it('returns the original booking and reports update failures', async () => {
    const booking = { id: 'booking-1', status: 'confirmed' } as BookingRecord;
    const updateError = new Error('status update failed');
    const updater = vi.fn<BookingInitialStatusUpdater>(async () => {
      throw updateError;
    });
    const onError = vi.fn();

    await expect(
      enforceBookingCreateInitialStatus({
        booking,
        client: {} as Parameters<BookingInitialStatusUpdater>[0],
        onError,
        reusedExisting: false,
        updater,
      }),
    ).resolves.toBe(booking);

    expect(onError).toHaveBeenCalledWith(updateError);
  });
});
