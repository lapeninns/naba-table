import { describe, expect, it } from 'vitest';

import {
  classifyGoogleBusinessProfilePushError,
  sanitizeGoogleErrorMessage,
} from '@/server/google-business-profile/workflowPushErrors';

describe('google business profile workflow push error helpers', () => {
  it('redacts token-like values from Google error messages', () => {
    expect(
      sanitizeGoogleErrorMessage(
        'Bearer abc.def?access_token=secret&key=abc token=hidden {"refresh_token":"json-secret"}',
      ),
    ).toBe(
      'Bearer [redacted]?access_token=[redacted] token=[redacted] {"refresh_token":"[redacted]"}',
    );
  });

  it('classifies quota and permission errors', () => {
    expect(
      classifyGoogleBusinessProfilePushError({
        status: 429,
        message: 'Quota exceeded for access_token=secret-token',
      }),
    ).toEqual({
      classification: 'quota',
      message: 'Quota exceeded for access_token=[redacted]',
    });

    expect(
      classifyGoogleBusinessProfilePushError({
        status: 403,
        message: 'Permission denied',
      }).classification,
    ).toBe('permission');
  });

  it('classifies unsupported field and validation errors', () => {
    expect(
      classifyGoogleBusinessProfilePushError(new Error('Unsupported update mask: moreHours'))
        .classification,
    ).toBe('unsupported_field');
    expect(
      classifyGoogleBusinessProfilePushError({
        status: 400,
        details: 'Bad request validation failed',
      }).classification,
    ).toBe('validation');
  });

  it('falls back to retryable when no specific Google error class matches', () => {
    expect(
      classifyGoogleBusinessProfilePushError({ message: 'temporary upstream failure' }),
    ).toEqual({
      classification: 'retryable',
      message: 'temporary upstream failure',
    });
  });
});
