import { describe, expect, it } from 'vitest';

import {
  buildGuestLookupAccessTokenNotConfiguredEvent,
  buildGuestLookupAllowedEvent,
  buildGuestLookupInvalidAccessTokenEvent,
  buildGuestLookupRateLimitedEvent,
} from '@/server/bookings/guest-lookup-observability';

describe('guest lookup observability events', () => {
  it('builds the access-token rejection event for missing token secret', () => {
    expect(
      buildGuestLookupAccessTokenNotConfiguredEvent({
        source: 'api.bookings',
        ipScope: '127.0.0.0/24',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'guest_lookup.access_token_rejected',
      severity: 'warning',
      context: {
        reason: 'secret_not_configured',
        ip_scope: '127.0.0.0/24',
      },
    });
  });

  it('builds the invalid access-token rejection event with restaurant context', () => {
    expect(
      buildGuestLookupInvalidAccessTokenEvent({
        source: 'api.bookings',
        reason: 'invalid_signature',
        ipScope: '127.0.0.0/24',
        restaurantId: 'restaurant-1',
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'guest_lookup.access_token_rejected',
      severity: 'warning',
      context: {
        reason: 'invalid_signature',
        ip_scope: '127.0.0.0/24',
        restaurant_id: 'restaurant-1',
      },
    });
  });

  it('keeps invalid access-token restaurant context null when unavailable', () => {
    expect(
      buildGuestLookupInvalidAccessTokenEvent({
        source: 'api.bookings',
        reason: 'invalid_payload',
        ipScope: '127.0.0.0/24',
        restaurantId: null,
      }).context,
    ).toEqual({
      reason: 'invalid_payload',
      ip_scope: '127.0.0.0/24',
      restaurant_id: null,
    });
  });

  it('builds the rate-limited event with retry diagnostics', () => {
    expect(
      buildGuestLookupRateLimitedEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        ipScope: '127.0.0.0/24',
        resetAt: 1_779_541_200_000,
        limit: 20,
        windowMs: 60_000,
        rateSource: 'memory',
        accessMode: 'contact_query',
        accessTokenUsed: false,
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'guest_lookup.rate_limited',
      severity: 'warning',
      context: {
        restaurant_id: 'restaurant-1',
        ip_scope: '127.0.0.0/24',
        reset_at: '2026-05-23T13:00:00.000Z',
        limit: 20,
        window_ms: 60_000,
        rate_source: 'memory',
        access_mode: 'contact_query',
        access_token_used: false,
      },
    });
  });

  it('builds the policy allowed event and derives matched from count', () => {
    expect(
      buildGuestLookupAllowedEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        ipScope: '127.0.0.0/24',
        count: 2,
        policyEnabled: true,
        lookupStrategy: 'policy',
        rateSource: 'cloudflare',
        accessMode: 'token',
        accessTokenUsed: true,
      }),
    ).toEqual({
      source: 'api.bookings',
      eventType: 'guest_lookup.allowed',
      context: {
        restaurant_id: 'restaurant-1',
        ip_scope: '127.0.0.0/24',
        matched: true,
        count: 2,
        policy_enabled: true,
        lookup_strategy: 'policy',
        rate_source: 'cloudflare',
        access_mode: 'token',
        access_token_used: true,
      },
    });
  });

  it('builds the legacy fallback allowed event with unmatched count', () => {
    expect(
      buildGuestLookupAllowedEvent({
        source: 'api.bookings',
        restaurantId: 'restaurant-1',
        ipScope: '127.0.0.0/24',
        count: 0,
        policyEnabled: true,
        lookupStrategy: 'legacy-fallback',
        rateSource: 'memory',
        accessMode: 'contact_query',
        accessTokenUsed: false,
      }).context,
    ).toEqual({
      restaurant_id: 'restaurant-1',
      ip_scope: '127.0.0.0/24',
      matched: false,
      count: 0,
      policy_enabled: true,
      lookup_strategy: 'legacy-fallback',
      rate_source: 'memory',
      access_mode: 'contact_query',
      access_token_used: false,
    });
  });
});
