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

  it('redacts route token path segments in free-form artifacts', () => {
    const redacted = redactQaText(
      'GET /invite/raw-invite-token-secret failed\nGET /bookings/recover/session-recovery-token-secret?safe=ok failed',
    );

    expect(redacted).not.toContain('raw-invite-token-secret');
    expect(redacted).not.toContain('session-recovery-token-secret');
    expect(redacted).toContain('safe=ok');
  });

  it('redacts common environment assignments and credential URLs in free-form artifacts', () => {
    const redacted = redactQaText(
      [
        'SUPABASE_SERVICE_ROLE_KEY=service-secret',
        'TWILIO_AUTH_TOKEN="twilio-secret"',
        'STRIPE_SECRET_KEY=stripe-secret',
        'DATABASE_URL=postgres://user:database-password@db.example.test:5432/app',
        'REDIS_URL=redis://:redis-password@redis.example.test:6379/0',
      ].join('\n'),
    );

    expect(redacted).not.toContain('service-secret');
    expect(redacted).not.toContain('twilio-secret');
    expect(redacted).not.toContain('stripe-secret');
    expect(redacted).not.toContain('database-password');
    expect(redacted).not.toContain('redis-password');
    expect(redacted).toContain('SUPABASE_SERVICE_ROLE_KEY=[redacted]');
    expect(redacted).toContain('DATABASE_URL=[redacted]');
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
