import { describe, expect, it } from 'vitest';

import {
  mapGoogleProviderErrorToPublishFailure,
  sanitizeGoogleProviderErrorMessage,
} from '@/server/dual-sync/publish/google-errors';

describe('mapGoogleProviderErrorToPublishFailure', () => {
  it('redacts token-like values from provider messages', () => {
    expect(
      sanitizeGoogleProviderErrorMessage(
        'Quota exceeded for Bearer abc.secret and access_token=token-value',
      ),
    ).toBe('Quota exceeded for Bearer [redacted] and access_token=[redacted]');
  });

  it('maps revoked credentials to reauth_required', () => {
    expect(
      mapGoogleProviderErrorToPublishFailure({
        code: 'GBP_REAUTH_REQUIRED',
        status: 409,
        message: 'Reconnect Google Business Profile',
      }),
    ).toMatchObject({
      code: 'REAUTH_REQUIRED',
      retryable: false,
    });
  });

  it('maps quota and rate limit errors to retryable quota failures', () => {
    expect(
      mapGoogleProviderErrorToPublishFailure({
        status: 429,
        message: 'Rate limit exceeded for key=secret',
      }),
    ).toMatchObject({
      code: 'QUOTA_LIMITED',
      retryable: true,
      message: 'Rate limit exceeded for key=[redacted]',
    });
  });

  it('maps permission errors to lost location access', () => {
    expect(
      mapGoogleProviderErrorToPublishFailure({
        status: 403,
        message: 'Permission denied',
      }),
    ).toMatchObject({
      code: 'LOCATION_ACCESS_LOST',
      retryable: false,
    });
  });

  it('maps validation and unsupported mask errors distinctly', () => {
    expect(mapGoogleProviderErrorToPublishFailure(new Error('Invalid phone number'))).toMatchObject(
      {
        code: 'GOOGLE_VALIDATION_FAILED',
        retryable: false,
      },
    );
    expect(
      mapGoogleProviderErrorToPublishFailure(new Error('Unsupported update mask: moreHours')),
    ).toMatchObject({
      code: 'UNSUPPORTED_FIELD',
      retryable: false,
    });
  });

  it('maps timeouts and unknown provider failures as retryable external API errors', () => {
    expect(mapGoogleProviderErrorToPublishFailure(new Error('Request timed out'))).toMatchObject({
      code: 'EXTERNAL_API_TIMEOUT',
      retryable: true,
    });
    expect(mapGoogleProviderErrorToPublishFailure(new Error('upstream broke'))).toMatchObject({
      code: 'EXTERNAL_API_ERROR',
      retryable: true,
    });
  });
});
