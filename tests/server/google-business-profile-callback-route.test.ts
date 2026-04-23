import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const completeGoogleBusinessProfileAuthorizationMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/google-business-profile/service', () => ({
  completeGoogleBusinessProfileAuthorization:
    completeGoogleBusinessProfileAuthorizationMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}));

import { GET } from '@/src/app/api/ops/google-business-profile/callback/route';

describe('google business profile callback route', () => {
  beforeEach(() => {
    completeGoogleBusinessProfileAuthorizationMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it('preserves the stored return host on successful authorization', async () => {
    completeGoogleBusinessProfileAuthorizationMock.mockResolvedValue({
      restaurantId: 'rest-1',
      returnPath: 'https://preview.nabatable.example/app/settings/restaurant/google-business-profile',
    });

    const response = await GET(
      new NextRequest(
        'https://preview.nabatable.example/api/ops/google-business-profile/callback?state=test-state&code=test-code',
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://preview.nabatable.example/app/settings/restaurant/google-business-profile?gbp=connected',
    );
    expect(completeGoogleBusinessProfileAuthorizationMock).toHaveBeenCalledWith({
      stateToken: 'test-state',
      code: 'test-code',
    });
  });

  it('preserves the forwarded host for error redirects', async () => {
    const response = await GET(
      new NextRequest(
        'http://internal-host/api/ops/google-business-profile/callback?error=access_denied',
        {
          headers: {
            'x-forwarded-host': 'staging.nabatable.example',
            'x-forwarded-proto': 'https',
          },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://staging.nabatable.example/app/settings/restaurant/google-business-profile?gbp=error&message=Google+authorization+was+cancelled+or+denied.',
    );
  });
});
