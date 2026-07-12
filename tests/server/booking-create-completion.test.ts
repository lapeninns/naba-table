import { NextResponse } from 'next/server';
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
const requestContext = {
  headerIdempotencyKey: 'header-idem-1',
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
      autoAssignEnabled: true,
      client,
      finalizer,
      inlineAutoAssignTimeoutMs: 4000,
      persistence,
      recoverySecret: 'recovery-secret',
      recoveryTtlSeconds: 900,
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
        booking: finalizedBooking,
        loyaltyPointsAwarded: 0,
        recoverySecret: 'recovery-secret',
        recoveryTtlSeconds: 900,
        restaurantId,
        reusedExisting: false,
        useUnifiedValidation: true,
      }),
    );
  });

  it('uses the non-PII customer id as the audit actor for a phone-only booking @contract', async () => {
    const phoneOnlyRequest = { ...request, email: '' };
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;

    await completeBookingCreate({
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

  it('passes finalization and response error callbacks through unchanged @contract', async () => {
    const callbacks = {
      onAutoAssignError: vi.fn(),
      onInlineAutoAssignError: vi.fn(),
      onRecoveryCookieError: vi.fn(),
      onSideEffectsError: vi.fn(),
      onTokenError: vi.fn(),
    };
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ ok: true }),
    ) as BookingCreateHttpResponseBuilder;

    await completeBookingCreate({
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
    expect(responseBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        onRecoveryCookieError: callbacks.onRecoveryCookieError,
        onTokenError: callbacks.onTokenError,
      }),
    );
  });

  it('preserves reused booking semantics through finalization and response @api @contract', async () => {
    const reusedPersistence = {
      ...persistence,
      reusedExisting: true,
    } satisfies Extract<BookingCreatePersistenceResult, { kind: 'created' }>;
    const finalizer = vi.fn(async () => ({ booking })) as BookingCreateFinalizer;
    const responseBuilder = vi.fn(async () =>
      NextResponse.json({ duplicate: true }, { status: 200 }),
    ) as BookingCreateHttpResponseBuilder;

    const response = await completeBookingCreate({
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

    await expect(response.json()).resolves.toEqual({ duplicate: true });
    expect(response.status).toBe(200);
    expect(finalizer).toHaveBeenCalledWith(expect.objectContaining({ reusedExisting: true }));
    expect(responseBuilder).toHaveBeenCalledWith(expect.objectContaining({ reusedExisting: true }));
  });
});
