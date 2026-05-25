import { NextResponse } from 'next/server';

import {
  buildGuestLookupAccessDiagnostics,
  markGuestLookupAccessTokenNotConfigured,
  markGuestLookupInvalidAccessToken,
  markGuestLookupRateSource,
  markGuestLookupResolvedRestaurantAccess,
  markGuestLookupValidTokenAccess,
} from '@/server/bookings/guest-lookup-access';
import { fetchGuestLookupBookings } from '@/server/bookings/guest-lookup-bookings';
import {
  buildGuestLookupAccessTokenNotConfiguredEvent,
  buildGuestLookupInvalidAccessTokenEvent,
  buildGuestLookupRateLimitedEvent,
} from '@/server/bookings/guest-lookup-observability';
import { buildGuestLookupRateLimitResponse } from '@/server/bookings/rate-limit-response';
import { contactBookingLookupQuerySchema } from '@/server/bookings/request-validation';
import { mapBookingZodValidationFailure } from '@/server/bookings/zod-validation-error';
import { recordObservabilityEvent } from '@/server/observability';
import { consumeRateLimit } from '@/server/security/rate-limit';
import { anonymizeIp } from '@/server/security/request';
import { validateSessionRecoveryAccessToken } from '@/server/security/session-recovery-access-token';
import {
  getDefaultRestaurantId,
  getRouteHandlerSupabaseClient,
  getTenantServiceSupabaseClient,
  MissingRestaurantContextError,
} from '@/server/supabase';

export type GuestLookupHttpRouteClientFactory = typeof getRouteHandlerSupabaseClient;
export type GuestLookupHttpTenantClientFactory = typeof getTenantServiceSupabaseClient;
export type GuestLookupHttpDefaultRestaurantIdResolver = typeof getDefaultRestaurantId;
export type GuestLookupHttpRateLimiter = typeof consumeRateLimit;
export type GuestLookupHttpEventRecorder = typeof recordObservabilityEvent;
export type GuestLookupHttpTokenValidator = typeof validateSessionRecoveryAccessToken;
export type GuestLookupHttpBookingFetcher = typeof fetchGuestLookupBookings;

export async function buildGuestLookupHttpResponse({
  clientIp,
  cookieAccessToken,
  defaultRestaurantIdFor = getDefaultRestaurantId,
  eventRecorder = recordObservabilityEvent,
  guestLookupPepper,
  guestLookupPolicyEnabled,
  lookupFetcher = fetchGuestLookupBookings,
  onPolicyLog,
  rateLimiter = consumeRateLimit,
  requestHeaders,
  requestSource = 'api.bookings',
  routeClientFor = getRouteHandlerSupabaseClient,
  searchParams,
  sessionRecoverySecret,
  tenantClientFor = getTenantServiceSupabaseClient,
  tokenValidator = validateSessionRecoveryAccessToken,
}: {
  clientIp: string;
  cookieAccessToken?: string | null;
  defaultRestaurantIdFor?: GuestLookupHttpDefaultRestaurantIdResolver;
  eventRecorder?: GuestLookupHttpEventRecorder;
  guestLookupPepper?: string | null;
  guestLookupPolicyEnabled: boolean;
  lookupFetcher?: GuestLookupHttpBookingFetcher;
  onPolicyLog?: (log: { kind: 'rpc_failed' | 'unexpected_error'; message: string }) => void;
  rateLimiter?: GuestLookupHttpRateLimiter;
  requestHeaders: Headers;
  requestSource?: string;
  routeClientFor?: GuestLookupHttpRouteClientFactory;
  searchParams: URLSearchParams;
  sessionRecoverySecret?: string | null;
  tenantClientFor?: GuestLookupHttpTenantClientFactory;
  tokenValidator?: GuestLookupHttpTokenValidator;
}): Promise<NextResponse> {
  const accessToken =
    requestHeaders.get('x-session-recovery-token') ??
    searchParams.get('access_token') ??
    searchParams.get('accessToken') ??
    cookieAccessToken ??
    null;
  const ipScope = anonymizeIp(clientIp);

  let access = buildGuestLookupAccessDiagnostics({ accessToken });
  let email: string;
  let phone: string;
  let targetRestaurantId: string;

  if (accessToken) {
    if (!sessionRecoverySecret) {
      access = markGuestLookupAccessTokenNotConfigured(access);
      void eventRecorder(
        buildGuestLookupAccessTokenNotConfiguredEvent({
          source: requestSource,
          ipScope,
        }),
      );

      return NextResponse.json(
        {
          error: 'Session recovery token not configured',
          code: 'ACCESS_TOKEN_NOT_CONFIGURED',
          access,
        },
        { status: 503 },
      );
    }

    const tokenResult = tokenValidator(accessToken, { secret: sessionRecoverySecret });
    if (!tokenResult.ok) {
      access = markGuestLookupInvalidAccessToken(access, {
        reason: tokenResult.reason,
        restaurantId: tokenResult.restaurantId ?? null,
      });
      void eventRecorder(
        buildGuestLookupInvalidAccessTokenEvent({
          source: requestSource,
          reason: tokenResult.reason,
          ipScope,
          restaurantId: tokenResult.restaurantId ?? null,
        }),
      );

      return NextResponse.json(
        { error: 'Invalid session recovery token', code: 'INVALID_ACCESS_TOKEN', access },
        { status: 401 },
      );
    }

    email = tokenResult.payload.email ?? '';
    phone = tokenResult.payload.phone ?? '';
    targetRestaurantId = tokenResult.payload.restaurantId;
    access = markGuestLookupValidTokenAccess(access, { restaurantId: targetRestaurantId });
  } else {
    const parsedQuery = contactBookingLookupQuerySchema.safeParse({
      email: searchParams.get('email'),
      phone: searchParams.get('phone'),
      restaurantId: searchParams.get('restaurantId') ?? undefined,
    });

    if (!parsedQuery.success) {
      const validationFailure = mapBookingZodValidationFailure(parsedQuery.error);
      return NextResponse.json(validationFailure.body, { status: validationFailure.status });
    }

    const { email: queryEmail, phone: queryPhone, restaurantId } = parsedQuery.data;
    email = queryEmail;
    phone = queryPhone;

    try {
      targetRestaurantId = restaurantId ?? (await defaultRestaurantIdFor());
      access = markGuestLookupResolvedRestaurantAccess(access, {
        restaurantId: targetRestaurantId,
        source: restaurantId ? 'query' : 'default',
      });
    } catch (error) {
      if (error instanceof MissingRestaurantContextError) {
        return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
      }
      throw error;
    }
  }

  const supabase = await routeClientFor();
  const tenantServiceClient = tenantClientFor(targetRestaurantId);

  const rateResult = await rateLimiter({
    identifier: `bookings:lookup:${targetRestaurantId}:${clientIp}`,
    limit: 20,
    windowMs: 60_000,
  });

  access = markGuestLookupRateSource(access, { rateSource: rateResult.source });

  if (!rateResult.ok) {
    void eventRecorder(
      buildGuestLookupRateLimitedEvent({
        source: requestSource,
        restaurantId: targetRestaurantId,
        ipScope,
        resetAt: rateResult.resetAt,
        limit: rateResult.limit,
        windowMs: 60_000,
        rateSource: rateResult.source,
        accessMode: access.mode,
        accessTokenUsed: access.token.provided,
      }),
    );

    const response = buildGuestLookupRateLimitResponse({ rateLimit: rateResult, access });
    return NextResponse.json(response.body, response.init);
  }

  const lookupResult = await lookupFetcher({
    policyClient: supabase,
    legacyClient: tenantServiceClient,
    restaurantId: targetRestaurantId,
    email,
    phone,
    access,
    policyEnabled: guestLookupPolicyEnabled && !!guestLookupPepper,
    source: requestSource,
    ipScope,
  });

  if (lookupResult.policyLog) {
    onPolicyLog?.(lookupResult.policyLog);
  }

  void eventRecorder(lookupResult.allowedEvent);

  return NextResponse.json({
    bookings: lookupResult.bookings,
    access: lookupResult.access,
  });
}
