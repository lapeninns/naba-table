import { describe, expect, it } from 'vitest';

import { sanitizeGoogleAuditPayload } from '@/server/dual-sync/publish/google-audit';

describe('sanitizeGoogleAuditPayload', () => {
  it('redacts sensitive keys recursively while preserving safe audit context', () => {
    const sanitized = sanitizeGoogleAuditPayload({
      status: 200,
      updateMask: ['profile'],
      authorization: 'Bearer raw-token',
      nested: {
        access_token: 'secret-token',
        fieldKey: 'profile.name',
        url: 'https://google.example/path?access_token=url-secret&code=auth-code',
      },
      rows: [
        {
          apiKey: 'api-secret',
          message: 'Quota for refresh_token=refresh-secret',
        },
      ],
    });

    expect(JSON.stringify(sanitized)).not.toContain('raw-token');
    expect(JSON.stringify(sanitized)).not.toContain('secret-token');
    expect(JSON.stringify(sanitized)).not.toContain('url-secret');
    expect(JSON.stringify(sanitized)).not.toContain('api-secret');
    expect(JSON.stringify(sanitized)).not.toContain('refresh-secret');
    expect(sanitized).toMatchObject({
      status: 200,
      updateMask: ['profile'],
      authorization: '[redacted]',
      nested: {
        access_token: '[redacted]',
        fieldKey: 'profile.name',
        url: 'https://google.example/path?access_token=[redacted]',
      },
      rows: [
        {
          apiKey: '[redacted]',
          message: 'Quota for refresh_token=[redacted]',
        },
      ],
    });
  });

  it('turns errors into redacted serializable summaries', () => {
    const sanitized = sanitizeGoogleAuditPayload(new Error('Bearer token-secret failed'));

    expect(sanitized).toEqual({
      name: 'Error',
      message: 'Bearer [redacted] failed',
    });
  });
});
