import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLogger } from '@/lib/logger';

describe('logger redaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts nested objects, arrays, and errors before serializing sensitive parent keys', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({}, { now: () => new Date('2026-05-05T12:00:00.000Z') });

    logger.info('auth callback failed', {
      auth: {
        token_hash: 'hash-secret',
        callbackUrl: '/api/auth/callback?code=auth-code&access_token=access-secret',
        errors: [new Error('access_token=error-secret')],
      },
      inviteTokens: ['invite-secret'],
      customer: {
        email: 'guest@example.com',
        phone: '+441234567890',
      },
    });

    const output = JSON.stringify(logSpy.mock.calls);
    expect(output).not.toContain('hash-secret');
    expect(output).not.toContain('auth-code');
    expect(output).not.toContain('access-secret');
    expect(output).not.toContain('error-secret');
    expect(output).not.toContain('invite-secret');
    expect(output).not.toContain('guest@example.com');
    expect(output).not.toContain('+441234567890');
  });

  it('redacts query parameter values in URL-like strings', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = createLogger({}, { now: () => new Date('2026-05-05T12:00:00.000Z') });

    logger.info('client error', {
      path: '/bookings/recover?access_token=recovery-secret&code=auth-code',
    });

    const output = JSON.stringify(logSpy.mock.calls);
    expect(output).not.toContain('recovery-secret');
    expect(output).not.toContain('auth-code');
    expect(output).toContain('redacted');
  });
});
