import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

import { GoogleBusinessProfileError } from './errors';

import type { Database } from '@/types/supabase';

export const GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH =
  '/app/settings/restaurant/google-business-profile';
export const GOOGLE_BUSINESS_PROFILE_RETURN_PATH_PREFIXES = [
  '/app/settings/restaurant/google-business-profile',
] as const;
export const GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

type OAuthStatePolicyFields = Pick<
  Database['public']['Tables']['restaurant_external_profile_oauth_states']['Row'],
  'requested_by_user_id' | 'restaurant_id' | 'consumed_at' | 'expires_at'
>;
type LegacyOAuthStateInsert = Pick<
  Database['public']['Tables']['restaurant_external_profile_oauth_states']['Insert'],
  | 'restaurant_id'
  | 'provider'
  | 'requested_by_user_id'
  | 'state_token'
  | 'return_path'
  | 'expires_at'
>;
type OAuthStateUpdate =
  Database['public']['Tables']['restaurant_external_profile_oauth_states']['Update'];

export function sanitizeOAuthReturnPath(returnPath: string | null | undefined): string {
  return sanitizeLocalRedirectPath(returnPath, {
    fallback: GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
    allowedPrefixes: GOOGLE_BUSINESS_PROFILE_RETURN_PATH_PREFIXES,
    allowAbsolute: true,
  });
}

export function buildGoogleBusinessProfileOAuthStateInsert(params: {
  restaurantId: string;
  requestedByUserId: string;
  stateToken: string;
  returnPath: string | null | undefined;
  expiresAt: string;
}): LegacyOAuthStateInsert {
  return {
    restaurant_id: params.restaurantId,
    provider: 'google_business_profile',
    requested_by_user_id: params.requestedByUserId,
    state_token: params.stateToken,
    return_path: sanitizeOAuthReturnPath(params.returnPath),
    expires_at: params.expiresAt,
  };
}

export function buildGoogleBusinessProfileOAuthStateConsumedUpdate(
  consumedAt: string,
): OAuthStateUpdate {
  return {
    consumed_at: consumedAt,
  };
}

export function createOAuthStateMismatchError(
  message: string,
  status = 400,
): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError(message, {
    code: 'GBP_INVALID_STATE',
    status,
  });
}

export function createOAuthStateNotFoundError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Google authorization state was not found.', {
    code: 'GBP_INVALID_STATE',
    status: 400,
  });
}

export function createOAuthStateAlreadyUsedError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Google authorization state has already been used.', {
    code: 'GBP_INVALID_STATE',
    status: 400,
  });
}

export function createOAuthStateExpiredError(): GoogleBusinessProfileError {
  return new GoogleBusinessProfileError('Google authorization state has expired.', {
    code: 'GBP_STATE_EXPIRED',
    status: 400,
  });
}

export function assertOAuthStateBelongsToRequest(
  state: Pick<OAuthStatePolicyFields, 'requested_by_user_id' | 'restaurant_id'>,
  params: {
    requestedByUserId: string;
    expectedRestaurantId?: string;
  },
): void {
  if (state.requested_by_user_id !== params.requestedByUserId) {
    throw createOAuthStateMismatchError(
      'Google authorization state did not match this session. Start the connection again from Nabatable.',
      403,
    );
  }

  if (params.expectedRestaurantId && state.restaurant_id !== params.expectedRestaurantId) {
    throw createOAuthStateMismatchError(
      'Google authorization state did not match this restaurant.',
    );
  }
}

export function assertOAuthStateRecordCanBeConsumed(
  state: Pick<OAuthStatePolicyFields, 'consumed_at' | 'expires_at'>,
  nowMs: number = Date.now(),
): void {
  if (state.consumed_at) {
    throw createOAuthStateAlreadyUsedError();
  }

  if (new Date(state.expires_at).getTime() < nowMs) {
    throw createOAuthStateExpiredError();
  }
}
