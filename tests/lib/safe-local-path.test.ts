import { describe, expect, it } from 'vitest';

import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';

describe('sanitizeLocalRedirectPath', () => {
  it('rejects protocol-relative and backslash-normalized redirect targets', () => {
    expect(sanitizeLocalRedirectPath('//evil.example/path', { fallback: '/safe' })).toBe('/safe');
    expect(sanitizeLocalRedirectPath('/\\evil.example/path', { fallback: '/safe' })).toBe('/safe');
    expect(sanitizeLocalRedirectPath('/%5Cevil.example/path', { fallback: '/safe' })).toBe('/safe');
  });

  it('keeps allowed local paths with query strings', () => {
    expect(
      sanitizeLocalRedirectPath('/guest/dashboard?tab=bookings', {
        fallback: '/safe',
        allowedPrefixes: ['/guest'],
      }),
    ).toBe('/guest/dashboard?tab=bookings');
  });

  it('extracts safe paths from absolute URLs only when explicitly allowed', () => {
    expect(
      sanitizeLocalRedirectPath('https://evil.example/app/settings', {
        fallback: '/safe',
        allowAbsolute: true,
        allowedPrefixes: ['/app'],
      }),
    ).toBe('/app/settings');

    expect(
      sanitizeLocalRedirectPath('https://evil.example/app/settings', {
        fallback: '/safe',
        allowedPrefixes: ['/app'],
      }),
    ).toBe('/safe');
  });
});
