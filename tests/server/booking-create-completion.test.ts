import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import {
  completeBookingCreate,
  type BookingCreateFinalizer,
  type BookingCreateHttpResponseBuilder,
} from '@/server/bookings/create-completion';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreatePersistenceResult } from '@/server/bookings/create-persistence';
import type { BookingCreateRequestContext } from '@/server/bookings/create-request-context';
import type { BookingCreateRequest } from '@/server/bookings/request-validation';

const client = { from: vi.fn() } as never;
const cookieRequest = new NextRequest('https://www.nabatable.com/api/bookings', { method: 'POST' });
const accessSecret = 'test-session-recovery-secret';
const restaurantId = '11111111-1111-4111-8111-111111111111';
const request = {
  restaurantId,
  date: '2026-07-01',
  time: '18:30',
  party: 4,
  bookingType: 'dinner',
  name: 'Alex Guest',
  email: 'alex@example.com',
  phone: '07123456789',
  marketingOptIn: false,
  whatsappOptIn: false,
} as BookingCreateRequest;
const HEADER_KEY = '0f8fad5b-d9cb-469f-a165-70867728950e';
const requestContext = {
  headerIdempotencyKey: HEADER_KEY,
  clientRequestId: 'client-request-1',
  opsEmailProvidedHeader: true,
  isOpsWalkIn: true,
  requestSource: 'ops.walkin',
  bookingSource: 'ops.walkin',
  bookingDetails: null,
} satisfies BookingCreateRequestContext;
const booking = {
  id: 'booking-1',
  customer_email: request.email,
  customer_phone: request.phone,
  status: 'pending',
} as BookingRecord;
const finalizedBooking = {
  ...booking,
  id: 'booking-final',
  status: 'confirmed',
} as BookingRecord;
const persistence = {
  kind: 'created',
  booking,
  customer: { id: 'customer-1' },
  idempotencyKey: 'idem-1',
  reusedExisting: false,
  createOrigin: 'inserted',
} satisfies Extract<BookingCreatePersistenceResult, { kind: 'created' }>;

describe('completeBookingCreate', () => {
  it('persists WhatsApp consent before notification-producing finalization @contract', async () => {
    const whatsappRequest = { ...request, whatsappOptIn: true };
    const consentedBooking = {
      ...booking,
      whatsapp_opt_in: true,
      whatsapp_consent_phone: request.phone,
    } as BookingRecord;
    const order: string[] = [];
    const consentPersister = vi.fn(async () => {
      order.push('consent');
      return consentedBooking;
    });
    const finalizer = vi.fn(async () => {
      order.push('finalize');
      return { booking: consentedBooking };
    }) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () => NextResponse.json({ ok: true }));

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      consentPersister,
      finalizer,
      persistence,
      request: whatsappRequest,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
    });

    expect(order).toEqual(['consent', 'finalize']);
    expect(consentPersister).toHaveBeenCalledWith({
      actorId: null,
      booking,
      client,
      optedIn: whatsappRequest.whatsappOptIn,
      restaurantId,
      source: 'guest_reserve',
    });
    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ booking: consentedBooking }));
  });

  it('still finalizes the committed booking when consent persistence fails @contract', async () => {
    const whatsappRequest = { ...request, whatsappOptIn: true };
    const consentError = new Error('Failed to persist WhatsApp consent for booking booking-1.');
    const consentPersister = vi.fn(async () => {
      throw consentError;
    });
    const onConsentPersistError = vi.fn();
    const finalizer = vi.fn(async () => ({ booking: finalizedBooking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: true }, { status: 201 }),
    ) as BookingCreateHttpResponseBuilder;

    const response = await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      consentPersister,
      finalizer,
      onConsentPersistError,
      persistence,
      request: whatsappRequest,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
    });

    expect(response.status).toBe(201);
    expect(onConsentPersistError).toHaveBeenCalledWith(consentError);
    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ booking }));
  });

  it('finalizes the booking before building the HTTP response @api @contract', async () => {
    const finalizer = vi.fn(async () => ({ booking: finalizedBooking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ bookingId: finalizedBooking.id }, { status: 201 }),
    ) as BookingCreateHttpResponseBuilder;

    const response = await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: true,
      client,
      finalizer,
      inlineAutoAssignTimeoutMs: 4000,
      persistence,
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: true,
    });

    await expect(response.json()).resolves.toEqual({ bookingId: 'booking-final' });
    expect(response.status).toBe(201);
    expect(finalizer).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: request.email,
        autoAssignEnabled: true,
        booking,
        client,
        customer: { id: 'customer-1' },
        idempotencyKey: 'idem-1',
        inlineAutoAssignTimeoutMs: 4000,
        isOpsWalkIn: true,
        opsEmailProvidedHeader: true,
        restaurantId,
        reusedExisting: false,
      }),
    );
    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        accessSecret,
        booking: finalizedBooking,
        contactEmail: request.email,
        cookieRequest,
        loyaltyPointsAwarded: 0,
        restaurantId,
        useUnifiedValidation: true,
      }),
    );
  });

  it('uses the non-PII customer id as the audit actor for a phone-only booking @contract', async () => {
    const phoneOnlyRequest = { ...request, email: '' };
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      finalizer,
      persistence,
      request: phoneOnlyRequest,
      requestContext,
      responseBuilder: vi.fn(async () => NextResponse.json({ ok: true })),
      restaurantId,
      useUnifiedValidation: false,
    });

    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ actor: 'customer-1' }));
  });

  it('passes finalization error callbacks through unchanged @contract', async () => {
    const callbacks = {
      onAutoAssignError: vi.fn(),
      onInlineAutoAssignError: vi.fn(),
      onSideEffectsError: vi.fn(),
    };
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: true }),
    ) as BookingCreateHttpResponseBuilder;

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      finalizer,
      persistence,
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
      ...callbacks,
    });

    expect(finalizer).toHaveBeenCalledWith(
      expect.objectContaining({
        onAutoAssignError: callbacks.onAutoAssignError,
        onInlineAutoAssignError: callbacks.onInlineAutoAssignError,
        onSideEffectsError: callbacks.onSideEffectsError,
      }),
    );
  });

  it('marks a recovered (non-key) match as not creator-eligible @api @contract', async () => {
    const reusedPersistence = {
      ...persistence,
      reusedExisting: true,
      createOrigin: 'recovered',
    } satisfies Extract<BookingCreatePersistenceResult, { kind: 'created' }>;
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ code: 'BOOKING_NOT_COMPLETED' }, { status: 409 }),
    ) as BookingCreateHttpResponseBuilder;

    const response = await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: true,
      client,
      finalizer,
      persistence: reusedPersistence,
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
    });

    await expect(response.json()).resolves.toEqual({ code: 'BOOKING_NOT_COMPLETED' });
    expect(response.status).toBe(409);
    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ reusedExisting: true }));
    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        createOrigin: 'recovered',
        creatorCapabilityEligible: false,
      }),
    );
  });

  it('threads createOrigin and creator eligibility to the response builder without side effects on replay', async () => {
    const now = new Date('2026-09-27T12:05:00.000Z').getTime();
    const replayed = {
      ...booking,
      idempotency_key: HEADER_KEY,
      created_at: '2026-09-27T12:00:00.000Z',
    } as BookingRecord;
    const finalizer = vi.fn(async () => ({ booking: replayed })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: true }, { status: 201 }),
    ) as BookingCreateHttpResponseBuilder;

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: true,
      client,
      finalizer,
      now: () => now,
      persistence: {
        ...persistence,
        booking: replayed,
        reusedExisting: true,
        createOrigin: 'key_replay',
      },
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: true,
    });

    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ reusedExisting: true }));
    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ createOrigin: 'key_replay', creatorCapabilityEligible: true }),
    );
  });

  it('marks fresh inserts as creator-eligible', async () => {
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: true }, { status: 201 }),
    ) as BookingCreateHttpResponseBuilder;

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      finalizer: vi.fn(async () => ({ booking })) as BookingCreateFinalizer,
      persistence,
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
    });

    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ createOrigin: 'inserted', creatorCapabilityEligible: true }),
    );
  });

  it('refuses creator eligibility for a key replay outside the 15-minute window', async () => {
    const now = new Date('2026-09-27T12:16:00.000Z').getTime();
    const replayed = {
      ...booking,
      idempotency_key: HEADER_KEY,
      created_at: '2026-09-27T12:00:00.000Z',
    } as BookingRecord;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: false }, { status: 409 }),
    ) as BookingCreateHttpResponseBuilder;

    await completeBookingCreate({
      accessSecret,
      cookieRequest,
      autoAssignEnabled: false,
      client,
      finalizer: vi.fn(async () => ({ booking: replayed })) as BookingCreateFinalizer,
      now: () => now,
      persistence: {
        ...persistence,
        booking: replayed,
        reusedExisting: true,
        createOrigin: 'key_replay',
      },
      request,
      requestContext,
      responseBuilder,
      restaurantId,
      useUnifiedValidation: false,
    });

    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ createOrigin: 'key_replay', creatorCapabilityEligible: false }),
    );
  });

  describe('WhatsApp consent is gated on creator capability (guest-auth §3/§4.2)', () => {
    const consentedBooking = {
      ...booking,
      whatsapp_opt_in: true,
      whatsapp_consent_phone: request.phone,
    } as BookingRecord;
    const whatsappRequest = { ...request, whatsappOptIn: true };

    it('does not write consent onto a booking matched by contact details (recovered) @security @contract', async () => {
      const consentPersister = vi.fn(async () => consentedBooking);
      const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;
      const responseBuilder = vi.fn(async () =>
        NextResponse.json({ code: 'BOOKING_NOT_COMPLETED' }, { status: 409 }),
      ) as BookingCreateHttpResponseBuilder;

      await completeBookingCreate({
        accessSecret,
        cookieRequest,
        autoAssignEnabled: false,
        client,
        consentPersister,
        finalizer,
        persistence: { ...persistence, reusedExisting: true, createOrigin: 'recovered' },
        request: whatsappRequest,
        requestContext,
        responseBuilder,
        restaurantId,
        useUnifiedValidation: false,
      });

      expect(consentPersister).not.toHaveBeenCalled();
      expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ booking }));
      expect(responseBuilder).toHaveBeenCalledWith(
        expect.objectContaining({ createOrigin: 'recovered', creatorCapabilityEligible: false }),
      );
    });

    it('does not write consent for a key replay outside the 15-minute window @security @contract', async () => {
      const now = new Date('2026-09-27T12:16:00.000Z').getTime();
      const replayed = {
        ...booking,
        idempotency_key: HEADER_KEY,
        created_at: '2026-09-27T12:00:00.000Z',
      } as BookingRecord;
      const consentPersister = vi.fn(async () => consentedBooking);
      const responseBuilder = vi.fn(async () =>
        NextResponse.json({ ok: false }, { status: 409 }),
      ) as BookingCreateHttpResponseBuilder;

      await completeBookingCreate({
        accessSecret,
        cookieRequest,
        autoAssignEnabled: false,
        client,
        consentPersister,
        finalizer: vi.fn(async () => ({ booking: replayed })) as BookingCreateFinalizer,
        now: () => now,
        persistence: {
          ...persistence,
          booking: replayed,
          reusedExisting: true,
          createOrigin: 'key_replay',
        },
        request: whatsappRequest,
        requestContext,
        responseBuilder,
        restaurantId,
        useUnifiedValidation: false,
      });

      expect(consentPersister).not.toHaveBeenCalled();
      expect(responseBuilder).toHaveBeenCalledWith(
        expect.objectContaining({ creatorCapabilityEligible: false }),
      );
    });

    it('does not write consent for a replay with a different header key @security @contract', async () => {
      const now = new Date('2026-09-27T12:05:00.000Z').getTime();
      const replayed = {
        ...booking,
        idempotency_key: '9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4',
        created_at: '2026-09-27T12:00:00.000Z',
      } as BookingRecord;
      const consentPersister = vi.fn(async () => consentedBooking);

      await completeBookingCreate({
        accessSecret,
        cookieRequest,
        autoAssignEnabled: false,
        client,
        consentPersister,
        finalizer: vi.fn(async () => ({ booking: replayed })) as BookingCreateFinalizer,
        now: () => now,
        persistence: {
          ...persistence,
          booking: replayed,
          reusedExisting: true,
          createOrigin: 'key_replay',
        },
        request: whatsappRequest,
        requestContext,
        responseBuilder: vi.fn(async () =>
          NextResponse.json({ ok: false }, { status: 409 }),
        ) as BookingCreateHttpResponseBuilder,
        restaurantId,
        useUnifiedValidation: false,
      });

      expect(consentPersister).not.toHaveBeenCalled();
    });

    it('still writes consent before finalization for a fresh own-key replay @contract', async () => {
      const now = new Date('2026-09-27T12:05:00.000Z').getTime();
      const replayed = {
        ...booking,
        idempotency_key: HEADER_KEY,
        created_at: '2026-09-27T12:00:00.000Z',
      } as BookingRecord;
      const order: string[] = [];
      const consentPersister = vi.fn(async () => {
        order.push('consent');
        return { ...replayed, whatsapp_opt_in: true } as BookingRecord;
      });
      const finalizer = vi.fn(async () => {
        order.push('finalize');
        return { booking: replayed };
      }) as BookingCreateFinalizer;

      await completeBookingCreate({
        accessSecret,
        cookieRequest,
        autoAssignEnabled: false,
        client,
        consentPersister,
        finalizer,
        now: () => now,
        persistence: {
          ...persistence,
          booking: replayed,
          reusedExisting: true,
          createOrigin: 'key_replay',
        },
        request: whatsappRequest,
        requestContext,
        responseBuilder: vi.fn(async () =>
          NextResponse.json({ ok: true }, { status: 201 }),
        ) as BookingCreateHttpResponseBuilder,
        restaurantId,
        useUnifiedValidation: false,
      });

      expect(order).toEqual(['consent', 'finalize']);
    });
  });
});
