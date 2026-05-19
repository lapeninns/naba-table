import { describe, expect, it } from 'vitest';

import { qaTitle, redactQaArtifact, redactQaText, validateQaTags } from '@/scripts/qa';

describe('QA artifact redaction', () => {
  it('redacts headers, cookies, tokens, emails, and phones in structured artifacts', () => {
    const artifact = {
      headers: [
        { name: 'authorization', value: 'Bearer bearer-secret' },
        { name: 'cookie', value: 'sb-access-token=session-cookie' },
      ],
      request: {
        body: 'email=guest@example.test&phone=+441234567890&access_token=body-secret',
        url: 'https://preview.example.test/path?access_token=query-secret&code=auth-code&safe=ok',
      },
      user: {
        email: 'guest@example.test',
        phone: '+44 7700 900123',
      },
    };

    const output = JSON.stringify(redactQaArtifact(artifact));

    expect(output).not.toContain('bearer-secret');
    expect(output).not.toContain('session-cookie');
    expect(output).not.toContain('guest@example.test');
    expect(output).not.toContain('+441234567890');
    expect(output).not.toContain('+44 7700 900123');
    expect(output).not.toContain('body-secret');
    expect(output).not.toContain('query-secret');
    expect(output).not.toContain('auth-code');
    expect(output).toContain('[redacted]');
    expect(output).toContain('[redacted-email]');
    expect(output).toContain('[redacted-phone]');
    expect(output).toContain('safe=ok');
  });

  it('redacts sensitive log-like text', () => {
    const redacted = redactQaText(
      'Authorization: Bearer token-secret\nSet-Cookie: sid=cookie-secret\nContact guest@example.test +447700900123 access_token=url-token',
    );

    expect(redacted).not.toContain('token-secret');
    expect(redacted).not.toContain('cookie-secret');
    expect(redacted).not.toContain('guest@example.test');
    expect(redacted).not.toContain('+447700900123');
    expect(redacted).not.toContain('url-token');
  });

  it('redacts embedded URL query secrets and header-like API keys in free-form artifacts', () => {
    const redacted = redactQaText(
      'GET https://preview.example.test/bookings/recover?key=query-key-secret&safe=ok failed\nGET /guest/dashboard?phone=%2B447700900124&token=relative-token\nX-Api-Key: header-api-key-secret\nX-Session-Token: header-session-secret',
    );

    expect(redacted).not.toContain('query-key-secret');
    expect(redacted).not.toContain('%2B447700900124');
    expect(redacted).not.toContain('relative-token');
    expect(redacted).not.toContain('header-api-key-secret');
    expect(redacted).not.toContain('header-session-secret');
    expect(redacted).toContain('safe=ok');
  });
});

describe('QA tag convention', () => {
  it('accepts known sprint tags and formats tagged titles', () => {
    const tags = validateQaTags(['@p0', '@browser', '@security']);

    expect(qaTitle('booking boundary rejects wrong tenant', tags)).toBe(
      '@p0 @browser @security booking boundary rejects wrong tenant',
    );
  });

  it('rejects unknown or unprefixed tags', () => {
    expect(() => validateQaTags(['p0'])).toThrow(/must start with @/);
    expect(() => validateQaTags(['@unknown'])).toThrow(/Unknown QA test tag/);
  });
});
