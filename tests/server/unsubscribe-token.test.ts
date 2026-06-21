import { describe, expect, it } from 'vitest';

import {
  createUnsubscribeToken,
  validateUnsubscribeToken,
} from '@/server/emails/unsubscribe-token';

const SECRET = 'test-unsubscribe-secret';

describe('unsubscribe tokens', () => {
  it('round-trips a normalized email', () => {
    const token = createUnsubscribeToken({
      email: '  Guest@Example.COM ',
      secret: SECRET,
      now: new Date('2026-06-21T12:00:00.000Z'),
    });

    const result = validateUnsubscribeToken(token, {
      secret: SECRET,
      now: new Date('2026-06-22T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe('guest@example.com');
    }
  });

  it('rejects a token signed with a different secret', () => {
    const token = createUnsubscribeToken({ email: 'guest@example.com', secret: SECRET });
    const result = validateUnsubscribeToken(token, { secret: 'other-secret' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_signature');
    }
  });

  it('rejects a tampered ciphertext', () => {
    const token = createUnsubscribeToken({ email: 'guest@example.com', secret: SECRET });
    const parts = token.split('.');
    // Flip a character in the ciphertext segment.
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A');
    const result = validateUnsubscribeToken(parts.join('.'), { secret: SECRET });

    expect(result.ok).toBe(false);
  });

  it('rejects an expired token', () => {
    const token = createUnsubscribeToken({
      email: 'guest@example.com',
      secret: SECRET,
      now: new Date('2026-01-01T00:00:00.000Z'),
      ttlSeconds: 60,
    });

    const result = validateUnsubscribeToken(token, {
      secret: SECRET,
      now: new Date('2026-01-01T00:02:00.000Z'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('expired');
    }
  });

  it('rejects a malformed token', () => {
    expect(validateUnsubscribeToken('not-a-token', { secret: SECRET }).ok).toBe(false);
    expect(validateUnsubscribeToken('a.b.c', { secret: SECRET }).ok).toBe(false);
  });

  it('rejects a token with the wrong prefix (cross-feature reuse)', () => {
    const token = createUnsubscribeToken({ email: 'guest@example.com', secret: SECRET });
    const swappedPrefix = token.replace(/^unsub1\./, 'sr2.');
    const result = validateUnsubscribeToken(swappedPrefix, { secret: SECRET });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('invalid_prefix');
    }
  });

  it('throws when no email is provided', () => {
    expect(() => createUnsubscribeToken({ email: '   ', secret: SECRET })).toThrow();
  });
});
