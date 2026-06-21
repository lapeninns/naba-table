export type GuestLookupAccessTokenRejectedEvent = {
  source: string;
  eventType: 'guest_lookup.access_token_rejected';
  severity: 'warning';
  context:
    | {
        reason: 'secret_not_configured';
        ip_scope: string;
      }
    | {
        reason: string;
        ip_scope: string;
        restaurant_id: string | null;
      };
};

export type GuestLookupRateLimitedEvent = {
  source: string;
  eventType: 'guest_lookup.rate_limited';
  severity: 'warning';
  context: {
    restaurant_id: string;
    ip_scope: string;
    reset_at: string;
    limit: number;
    window_ms: number;
    rate_source: string;
    access_mode: string;
    access_token_used: boolean;
  };
};

export type GuestLookupAllowedEvent = {
  source: string;
  eventType: 'guest_lookup.allowed';
  context: {
    restaurant_id: string;
    ip_scope: string;
    matched: boolean;
    count: number;
    policy_enabled: boolean;
    lookup_strategy: 'policy' | 'legacy' | 'legacy-fallback';
    rate_source: string;
    access_mode: string;
    access_token_used: boolean;
  };
};

export function buildGuestLookupAccessTokenNotConfiguredEvent({
  source,
  ipScope,
}: {
  source: string;
  ipScope: string;
}): GuestLookupAccessTokenRejectedEvent {
  return {
    source,
    eventType: 'guest_lookup.access_token_rejected',
    severity: 'warning',
    context: {
      reason: 'secret_not_configured',
      ip_scope: ipScope,
    },
  };
}

export function buildGuestLookupRateLimitedEvent({
  source,
  restaurantId,
  ipScope,
  resetAt,
  limit,
  windowMs,
  rateSource,
  accessMode,
  accessTokenUsed,
}: {
  source: string;
  restaurantId: string;
  ipScope: string;
  resetAt: number;
  limit: number;
  windowMs: number;
  rateSource: string;
  accessMode: string;
  accessTokenUsed: boolean;
}): GuestLookupRateLimitedEvent {
  return {
    source,
    eventType: 'guest_lookup.rate_limited',
    severity: 'warning',
    context: {
      restaurant_id: restaurantId,
      ip_scope: ipScope,
      reset_at: new Date(resetAt).toISOString(),
      limit,
      window_ms: windowMs,
      rate_source: rateSource,
      access_mode: accessMode,
      access_token_used: accessTokenUsed,
    },
  };
}

export function buildGuestLookupAllowedEvent({
  source,
  restaurantId,
  ipScope,
  count,
  policyEnabled,
  lookupStrategy,
  rateSource,
  accessMode,
  accessTokenUsed,
}: {
  source: string;
  restaurantId: string;
  ipScope: string;
  count: number;
  policyEnabled: boolean;
  lookupStrategy: 'policy' | 'legacy' | 'legacy-fallback';
  rateSource: string;
  accessMode: string;
  accessTokenUsed: boolean;
}): GuestLookupAllowedEvent {
  return {
    source,
    eventType: 'guest_lookup.allowed',
    context: {
      restaurant_id: restaurantId,
      ip_scope: ipScope,
      matched: count > 0,
      count,
      policy_enabled: policyEnabled,
      lookup_strategy: lookupStrategy,
      rate_source: rateSource,
      access_mode: accessMode,
      access_token_used: accessTokenUsed,
    },
  };
}

export function buildGuestLookupInvalidAccessTokenEvent({
  source,
  reason,
  ipScope,
  restaurantId,
}: {
  source: string;
  reason: string;
  ipScope: string;
  restaurantId: string | null;
}): GuestLookupAccessTokenRejectedEvent {
  return {
    source,
    eventType: 'guest_lookup.access_token_rejected',
    severity: 'warning',
    context: {
      reason,
      ip_scope: ipScope,
      restaurant_id: restaurantId,
    },
  };
}
