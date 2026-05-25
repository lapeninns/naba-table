import { describe, expect, it } from 'vitest';

import {
  buildGuestLookupAccessDiagnostics,
  markGuestLookupAccessTokenNotConfigured,
  markGuestLookupInvalidAccessToken,
  markGuestLookupPolicyEnabled,
  markGuestLookupRateSource,
  markGuestLookupResolvedRestaurantAccess,
  markGuestLookupStrategy,
  markGuestLookupValidTokenAccess,
  type GuestLookupAccessDiagnostics,
} from '@/server/bookings/guest-lookup-access';

describe('guest lookup access diagnostics', () => {
  it('builds contact-query diagnostics when no access token is present', () => {
    expect(buildGuestLookupAccessDiagnostics({ accessToken: null })).toEqual({
      mode: 'contact_query',
      token: {
        provided: false,
        valid: false,
        reason: null,
        restaurantId: null,
      },
      restaurantId: null,
      restaurantSource: 'query',
      lookupStrategy: 'unknown',
      policyEnabled: false,
      rateSource: 'unknown',
    });
  });

  it('builds token diagnostics when an access token is present', () => {
    expect(buildGuestLookupAccessDiagnostics({ accessToken: 'token-value' })).toEqual({
      mode: 'token',
      token: {
        provided: true,
        valid: false,
        reason: null,
        restaurantId: null,
      },
      restaurantId: null,
      restaurantSource: 'query',
      lookupStrategy: 'unknown',
      policyEnabled: false,
      rateSource: 'unknown',
    });
  });

  it('marks missing token configuration without changing existing diagnostic context', () => {
    const access = buildGuestLookupAccessDiagnostics({ accessToken: 'token-value' });

    expect(markGuestLookupAccessTokenNotConfigured(access)).toEqual({
      ...access,
      token: {
        ...access.token,
        reason: 'secret_not_configured',
      },
    });
    expect(access.token.reason).toBeNull();
  });

  it('marks invalid access tokens with reason and optional restaurant context', () => {
    const access = buildGuestLookupAccessDiagnostics({ accessToken: 'token-value' });

    expect(
      markGuestLookupInvalidAccessToken(access, {
        reason: 'invalid_signature',
        restaurantId: 'restaurant-1',
      }),
    ).toEqual({
      ...access,
      token: {
        ...access.token,
        reason: 'invalid_signature',
        restaurantId: 'restaurant-1',
      },
      restaurantId: 'restaurant-1',
    });
  });

  it('marks valid token access as token-scoped restaurant access', () => {
    const access = buildGuestLookupAccessDiagnostics({ accessToken: 'token-value' });

    expect(markGuestLookupValidTokenAccess(access, { restaurantId: 'restaurant-1' })).toEqual({
      ...access,
      token: {
        ...access.token,
        valid: true,
        restaurantId: 'restaurant-1',
      },
      restaurantId: 'restaurant-1',
      restaurantSource: 'token',
    });
  });

  it('marks query and default restaurant resolution', () => {
    const access = buildGuestLookupAccessDiagnostics({ accessToken: null });

    expect(
      markGuestLookupResolvedRestaurantAccess(access, {
        restaurantId: 'restaurant-query',
        source: 'query',
      }),
    ).toMatchObject({
      restaurantId: 'restaurant-query',
      restaurantSource: 'query',
    });
    expect(
      markGuestLookupResolvedRestaurantAccess(access, {
        restaurantId: 'restaurant-default',
        source: 'default',
      }),
    ).toMatchObject({
      restaurantId: 'restaurant-default',
      restaurantSource: 'default',
    });
  });

  it('marks rate source, policy state, and lookup strategy independently', () => {
    const access: GuestLookupAccessDiagnostics = {
      ...buildGuestLookupAccessDiagnostics({ accessToken: null }),
      restaurantId: 'restaurant-1',
      restaurantSource: 'default',
    };

    const withRateSource = markGuestLookupRateSource(access, { rateSource: 'memory' });
    const withPolicy = markGuestLookupPolicyEnabled(withRateSource, { policyEnabled: true });

    expect(markGuestLookupStrategy(withPolicy, { lookupStrategy: 'legacy-fallback' })).toEqual({
      ...access,
      rateSource: 'memory',
      policyEnabled: true,
      lookupStrategy: 'legacy-fallback',
    });
  });
});
