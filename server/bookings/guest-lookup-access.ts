export type GuestLookupAccessMode = 'token' | 'contact_query';
export type GuestLookupRestaurantSource = 'query' | 'default' | 'token';
export type GuestLookupStrategy = 'unknown' | 'policy' | 'legacy' | 'legacy-fallback';
export type GuestLookupRateSource = 'unknown' | 'cloudflare' | 'memory' | 'none';

export type GuestLookupAccessDiagnostics = {
  mode: GuestLookupAccessMode;
  token: {
    provided: boolean;
    valid: boolean;
    reason: string | null;
    restaurantId: string | null;
  };
  restaurantId: string | null;
  restaurantSource: GuestLookupRestaurantSource;
  lookupStrategy: GuestLookupStrategy;
  policyEnabled: boolean;
  rateSource: GuestLookupRateSource;
};

export function buildGuestLookupAccessDiagnostics({
  accessToken,
}: {
  accessToken: string | null;
}): GuestLookupAccessDiagnostics {
  return {
    mode: accessToken ? 'token' : 'contact_query',
    token: {
      provided: Boolean(accessToken),
      valid: false,
      reason: null,
      restaurantId: null,
    },
    restaurantId: null,
    restaurantSource: 'query',
    lookupStrategy: 'unknown',
    policyEnabled: false,
    rateSource: 'unknown',
  };
}

export function markGuestLookupAccessTokenNotConfigured(
  access: GuestLookupAccessDiagnostics,
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    token: {
      ...access.token,
      reason: 'secret_not_configured',
    },
  };
}

export function markGuestLookupInvalidAccessToken(
  access: GuestLookupAccessDiagnostics,
  {
    reason,
    restaurantId,
  }: {
    reason: string;
    restaurantId: string | null;
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    token: {
      ...access.token,
      reason,
      restaurantId,
    },
    restaurantId,
  };
}

export function markGuestLookupValidTokenAccess(
  access: GuestLookupAccessDiagnostics,
  {
    restaurantId,
  }: {
    restaurantId: string;
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    token: {
      ...access.token,
      valid: true,
      restaurantId,
    },
    restaurantId,
    restaurantSource: 'token',
  };
}

export function markGuestLookupResolvedRestaurantAccess(
  access: GuestLookupAccessDiagnostics,
  {
    restaurantId,
    source,
  }: {
    restaurantId: string;
    source: 'query' | 'default';
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    restaurantId,
    restaurantSource: source,
  };
}

export function markGuestLookupRateSource(
  access: GuestLookupAccessDiagnostics,
  {
    rateSource,
  }: {
    rateSource: Exclude<GuestLookupRateSource, 'unknown'>;
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    rateSource,
  };
}

export function markGuestLookupPolicyEnabled(
  access: GuestLookupAccessDiagnostics,
  {
    policyEnabled,
  }: {
    policyEnabled: boolean;
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    policyEnabled,
  };
}

export function markGuestLookupStrategy(
  access: GuestLookupAccessDiagnostics,
  {
    lookupStrategy,
  }: {
    lookupStrategy: Exclude<GuestLookupStrategy, 'unknown'>;
  },
): GuestLookupAccessDiagnostics {
  return {
    ...access,
    lookupStrategy,
  };
}
