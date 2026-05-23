import { describe, expect, it, vi } from 'vitest';

import {
  buildGuestLookupHttpResponse,
  type GuestLookupHttpBookingFetcher,
  type GuestLookupHttpDefaultRestaurantIdResolver,
  type GuestLookupHttpEventRecorder,
  type GuestLookupHttpRateLimiter,
  type GuestLookupHttpRouteClientFactory,
  type GuestLookupHttpTenantClientFactory,
  type GuestLookupHttpTokenValidator,
} from '@/server/bookings/guest-lookup-response';
import { MissingRestaurantContextError } from '@/server/supabase';

import type { GuestLookupBookingsResult } from '@/server/bookings/guest-lookup-bookings';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const routeClient = { kind: 'route-client' };
const tenantClient = { kind: 'tenant-client' };

function createBaseDeps() {
  const eventRecorder = vi.fn(async () => undefined) as GuestLookupHttpEventRecorder;
  const rateLimiter = vi.fn(async () => ({
    ok: true,
    limit: 20,
    remaining: 19,
    resetAt: 1_779_541_200_000,
    source: 'memory' as const,
  })) as GuestLookupHttpRateLimiter;
  const routeClientFor = vi.fn(async () => routeClient) as GuestLookupHttpRouteClientFactory;
  const tenantClientFor = vi.fn(() => tenantClient) as GuestLookupHttpTenantClientFactory;

  return { eventRecorder, rateLimiter, routeClientFor, tenantClientFor };
}

describe('buildGuestLookupHttpResponse', () => {
  it('runs contact-query lookup and records the allowed event', async () => {
    const deps = createBaseDeps();
    const lookupFetcher = vi.fn(async (params) => {
      expect(params).toMatchObject({
        policyClient: routeClient,
        legacyClient: tenantClient,
        restaurantId,
        email: 'guest@example.com',
        phone: '07123456789',
        policyEnabled: true,
        source: 'api.bookings',
      });
      expect(params.access).toMatchObject({
        mode: 'contact_query',
        restaurantId,
        restaurantSource: 'query',
        rateSource: 'memory',
      });

      return {
        bookings: [{ id: 'booking-1' }],
        access: params.access,
        allowedEvent: {
          source: 'api.bookings',
          eventType: 'guest_lookup.allowed',
          context: { restaurant_id: restaurantId },
        },
      } as GuestLookupBookingsResult;
    }) as GuestLookupHttpBookingFetcher;

    const response = await buildGuestLookupHttpResponse({
      ...deps,
      clientIp: '192.0.2.10',
      guestLookupPepper: 'pepper',
      guestLookupPolicyEnabled: true,
      lookupFetcher,
      requestHeaders: new Headers(),
      searchParams: new URLSearchParams({
        email: 'guest@example.com',
        phone: '07123456789',
        restaurantId,
      }),
      sessionRecoverySecret: 'secret',
    });

    await expect(response.json()).resolves.toMatchObject({
      bookings: [{ id: 'booking-1' }],
      access: {
        mode: 'contact_query',
        restaurantId,
        restaurantSource: 'query',
        rateSource: 'memory',
      },
    });
    expect(response.status).toBe(200);
    expect(deps.rateLimiter).toHaveBeenCalledWith({
      identifier: `bookings:lookup:${restaurantId}:192.0.2.10`,
      limit: 20,
      windowMs: 60_000,
    });
    expect(deps.eventRecorder).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'guest_lookup.allowed' }),
    );
  });

  it('returns the missing-token-secret response before lookup work', async () => {
    const deps = createBaseDeps();
    const lookupFetcher = vi.fn() as unknown as GuestLookupHttpBookingFetcher;

    const response = await buildGuestLookupHttpResponse({
      ...deps,
      clientIp: '192.0.2.10',
      guestLookupPepper: 'pepper',
      guestLookupPolicyEnabled: true,
      lookupFetcher,
      requestHeaders: new Headers({ 'x-session-recovery-token': 'token-1' }),
      searchParams: new URLSearchParams(),
      sessionRecoverySecret: null,
    });

    await expect(response.json()).resolves.toMatchObject({
      error: 'Session recovery token not configured',
      code: 'ACCESS_TOKEN_NOT_CONFIGURED',
      access: {
        token: {
          provided: true,
          reason: 'secret_not_configured',
        },
      },
    });
    expect(response.status).toBe(503);
    expect(deps.eventRecorder).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'guest_lookup.access_token_rejected' }),
    );
    expect(lookupFetcher).not.toHaveBeenCalled();
    expect(deps.rateLimiter).not.toHaveBeenCalled();
  });

  it('returns invalid access-token responses with diagnostics and observability', async () => {
    const deps = createBaseDeps();
    const tokenValidator = vi.fn(() => ({
      ok: false,
      reason: 'invalid_signature' as const,
      restaurantId,
    })) as GuestLookupHttpTokenValidator;

    const response = await buildGuestLookupHttpResponse({
      ...deps,
      clientIp: '192.0.2.10',
      guestLookupPepper: null,
      guestLookupPolicyEnabled: false,
      requestHeaders: new Headers({ 'x-session-recovery-token': 'token-1' }),
      searchParams: new URLSearchParams(),
      sessionRecoverySecret: 'secret',
      tokenValidator,
    });

    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid session recovery token',
      code: 'INVALID_ACCESS_TOKEN',
      access: {
        restaurantId,
        token: {
          provided: true,
          reason: 'invalid_signature',
          restaurantId,
        },
      },
    });
    expect(response.status).toBe(401);
    expect(deps.eventRecorder).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'guest_lookup.access_token_rejected',
        context: expect.objectContaining({ reason: 'invalid_signature' }),
      }),
    );
    expect(deps.rateLimiter).not.toHaveBeenCalled();
  });

  it('returns the guest lookup rate-limit response and records rate-limit observability', async () => {
    const deps = createBaseDeps();
    const rateLimiter = vi.fn(async () => ({
      ok: false,
      limit: 20,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      source: 'memory' as const,
    })) as GuestLookupHttpRateLimiter;
    const lookupFetcher = vi.fn() as unknown as GuestLookupHttpBookingFetcher;

    const response = await buildGuestLookupHttpResponse({
      ...deps,
      clientIp: '192.0.2.10',
      guestLookupPepper: null,
      guestLookupPolicyEnabled: false,
      lookupFetcher,
      rateLimiter,
      requestHeaders: new Headers(),
      searchParams: new URLSearchParams({
        email: 'guest@example.com',
        phone: '07123456789',
        restaurantId,
      }),
      sessionRecoverySecret: 'secret',
    });

    await expect(response.json()).resolves.toMatchObject({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      access: {
        rateSource: 'memory',
      },
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(deps.eventRecorder).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'guest_lookup.rate_limited' }),
    );
    expect(lookupFetcher).not.toHaveBeenCalled();
  });

  it('preserves the missing restaurant context response for contact queries without a fallback', async () => {
    const deps = createBaseDeps();
    const defaultRestaurantIdFor = vi.fn(async () => {
      throw new MissingRestaurantContextError();
    }) as GuestLookupHttpDefaultRestaurantIdResolver;

    const response = await buildGuestLookupHttpResponse({
      ...deps,
      clientIp: '192.0.2.10',
      defaultRestaurantIdFor,
      guestLookupPepper: null,
      guestLookupPolicyEnabled: false,
      requestHeaders: new Headers(),
      searchParams: new URLSearchParams({
        email: 'guest@example.com',
        phone: '07123456789',
      }),
      sessionRecoverySecret: 'secret',
    });

    await expect(response.json()).resolves.toEqual({ error: 'restaurantId is required' });
    expect(response.status).toBe(400);
    expect(deps.rateLimiter).not.toHaveBeenCalled();
  });
});
