import { describe, expect, it } from 'vitest';

import { GoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import {
  assertOAuthStateBelongsToRequest,
  assertOAuthStateRecordCanBeConsumed,
  buildGoogleBusinessProfileOAuthStateConsumedUpdate,
  buildGoogleBusinessProfileOAuthStateInsert,
  createOAuthStateAlreadyUsedError,
  createOAuthStateExpiredError,
  createOAuthStateMismatchError,
  createOAuthStateNotFoundError,
  GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
  GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS,
  sanitizeOAuthReturnPath,
} from '@/server/google-business-profile/serviceOAuthState';

describe('google business profile service OAuth state domain', () => {
  it('sanitizes OAuth return paths to the Google Business Profile settings area', () => {
    expect(sanitizeOAuthReturnPath(null)).toBe(GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH);
    expect(sanitizeOAuthReturnPath('/app/settings/restaurant/google-business-profile')).toBe(
      '/app/settings/restaurant/google-business-profile',
    );
    expect(
      sanitizeOAuthReturnPath(
        '/app/settings/restaurant/google-business-profile/locations?refresh=1#connect',
      ),
    ).toBe('/app/settings/restaurant/google-business-profile/locations?refresh=1#connect');
    expect(
      sanitizeOAuthReturnPath(
        'https://preview.nabatable.example/app/settings/restaurant/google-business-profile?tab=gbp',
      ),
    ).toBe('/app/settings/restaurant/google-business-profile?tab=gbp');
    expect(sanitizeOAuthReturnPath('/app/settings/restaurant')).toBe(
      GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
    );
    expect(sanitizeOAuthReturnPath('//evil.example/path')).toBe(
      GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH,
    );
  });

  it('keeps the OAuth state TTL explicit', () => {
    expect(GOOGLE_BUSINESS_PROFILE_OAUTH_STATE_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('builds OAuth state insert payloads with sanitized return paths', () => {
    expect(
      buildGoogleBusinessProfileOAuthStateInsert({
        restaurantId: 'rest-1',
        requestedByUserId: 'user-1',
        stateToken: 'state-token',
        returnPath:
          'https://preview.nabatable.example/app/settings/restaurant/google-business-profile?tab=gbp',
        expiresAt: '2026-05-21T12:15:00.000Z',
      }),
    ).toEqual({
      restaurant_id: 'rest-1',
      provider: 'google_business_profile',
      requested_by_user_id: 'user-1',
      state_token: 'state-token',
      return_path: '/app/settings/restaurant/google-business-profile?tab=gbp',
      expires_at: '2026-05-21T12:15:00.000Z',
    });

    expect(
      buildGoogleBusinessProfileOAuthStateInsert({
        restaurantId: 'rest-1',
        requestedByUserId: 'user-1',
        stateToken: 'state-token',
        returnPath: '/app/settings/restaurant',
        expiresAt: '2026-05-21T12:15:00.000Z',
      }).return_path,
    ).toBe(GOOGLE_BUSINESS_PROFILE_DEFAULT_RETURN_PATH);
  });

  it('builds OAuth state consumed update payloads', () => {
    expect(buildGoogleBusinessProfileOAuthStateConsumedUpdate('2026-05-21T12:00:00.000Z')).toEqual({
      consumed_at: '2026-05-21T12:00:00.000Z',
    });
  });

  it('creates stable OAuth state errors', () => {
    expect(createOAuthStateMismatchError('Mismatch', 403)).toMatchObject({
      code: 'GBP_INVALID_STATE',
      status: 403,
      message: 'Mismatch',
    });
    expect(createOAuthStateNotFoundError()).toMatchObject({
      code: 'GBP_INVALID_STATE',
      status: 400,
      message: 'Google authorization state was not found.',
    });
    expect(createOAuthStateAlreadyUsedError()).toMatchObject({
      code: 'GBP_INVALID_STATE',
      status: 400,
      message: 'Google authorization state has already been used.',
    });
    expect(createOAuthStateExpiredError()).toMatchObject({
      code: 'GBP_STATE_EXPIRED',
      status: 400,
      message: 'Google authorization state has expired.',
    });
  });

  it('accepts OAuth state ownership when the initiating user and route restaurant match', () => {
    expect(() =>
      assertOAuthStateBelongsToRequest(
        {
          requested_by_user_id: 'user-1',
          restaurant_id: 'rest-1',
        },
        {
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
        },
      ),
    ).not.toThrow();
  });

  it('rejects OAuth state ownership for a different initiating user', () => {
    expect(() =>
      assertOAuthStateBelongsToRequest(
        {
          requested_by_user_id: 'user-2',
          restaurant_id: 'rest-1',
        },
        {
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
        },
      ),
    ).toThrow(GoogleBusinessProfileError);

    try {
      assertOAuthStateBelongsToRequest(
        {
          requested_by_user_id: 'user-2',
          restaurant_id: 'rest-1',
        },
        {
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
        },
      );
      throw new Error('Expected OAuth state user mismatch to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_INVALID_STATE',
        status: 403,
      });
    }
  });

  it('rejects OAuth state ownership for a different route restaurant', () => {
    try {
      assertOAuthStateBelongsToRequest(
        {
          requested_by_user_id: 'user-1',
          restaurant_id: 'rest-2',
        },
        {
          requestedByUserId: 'user-1',
          expectedRestaurantId: 'rest-1',
        },
      );
      throw new Error('Expected OAuth state restaurant mismatch to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_INVALID_STATE',
        status: 400,
        message: 'Google authorization state did not match this restaurant.',
      });
    }
  });

  it('accepts unconsumed OAuth state records that have not expired', () => {
    expect(() =>
      assertOAuthStateRecordCanBeConsumed(
        {
          consumed_at: null,
          expires_at: '2026-05-21T12:15:00.000Z',
        },
        new Date('2026-05-21T12:00:00.000Z').getTime(),
      ),
    ).not.toThrow();
  });

  it('rejects consumed and expired OAuth state records with stable errors', () => {
    try {
      assertOAuthStateRecordCanBeConsumed(
        {
          consumed_at: '2026-05-21T12:00:00.000Z',
          expires_at: '2026-05-21T12:15:00.000Z',
        },
        new Date('2026-05-21T12:00:00.000Z').getTime(),
      );
      throw new Error('Expected consumed OAuth state to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_INVALID_STATE',
        status: 400,
      });
    }

    try {
      assertOAuthStateRecordCanBeConsumed(
        {
          consumed_at: null,
          expires_at: '2026-05-21T11:59:59.999Z',
        },
        new Date('2026-05-21T12:00:00.000Z').getTime(),
      );
      throw new Error('Expected expired OAuth state to throw.');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'GBP_STATE_EXPIRED',
        status: 400,
      });
    }
  });
});
