import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
  getGoogleBusinessProfileOAuthStateCookieRestaurantId,
  setGoogleBusinessProfileOAuthStateCookie,
} from '@/server/google-business-profile/oauth-state-cookie';

describe('Google Business Profile OAuth state cookie', () => {
  it('returns the tenant only when the callback state exactly matches the cookie state', () => {
    // Given
    const response = new NextResponse();
    setGoogleBusinessProfileOAuthStateCookie(response, 'oauth-state-1', 'restaurant-1');
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    const request = new NextRequest(
      'https://app.nabatable.com/api/ops/google-business-profile/callback',
      {
        headers: { cookie },
      },
    );

    // When
    const restaurantId = getGoogleBusinessProfileOAuthStateCookieRestaurantId(
      request,
      'oauth-state-1',
    );

    // Then
    expect(restaurantId).toBe('restaurant-1');
  });

  it('rejects malformed, legacy, and mismatched state cookies', () => {
    // Given
    const url = 'https://app.nabatable.com/api/ops/google-business-profile/callback';
    const malformedRequest = new NextRequest(url, {
      headers: { cookie: 'sr-gbp-oauth-state=not-a-bound-cookie' },
    });
    const response = new NextResponse();
    setGoogleBusinessProfileOAuthStateCookie(response, 'oauth-state-1', 'restaurant-1');
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
    const mismatchedRequest = new NextRequest(url, { headers: { cookie } });

    // When
    const malformedRestaurantId = getGoogleBusinessProfileOAuthStateCookieRestaurantId(
      malformedRequest,
      'oauth-state-1',
    );
    const mismatchedRestaurantId = getGoogleBusinessProfileOAuthStateCookieRestaurantId(
      mismatchedRequest,
      'oauth-state-2',
    );

    // Then
    expect(malformedRestaurantId).toBeNull();
    expect(mismatchedRestaurantId).toBeNull();
  });
});
