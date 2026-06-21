import { afterEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  security: { sessionRecoveryAccessTokenSecret: 'test-secret-unsub' as string | null },
}));

vi.mock('@/lib/env', () => ({ env: mockEnv }));

import { buildListUnsubscribeHeaders } from '@/server/emails/list-unsubscribe';
import { validateUnsubscribeToken } from '@/server/emails/unsubscribe-token';

afterEach(() => {
  mockEnv.security.sessionRecoveryAccessTokenSecret = 'test-secret-unsub';
});

describe('buildListUnsubscribeHeaders', () => {
  it('emits a one-click HTTPS entry, a mailto fallback, and the one-click POST header', () => {
    const headers = buildListUnsubscribeHeaders('guest@example.com');

    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

    const value = headers['List-Unsubscribe'];
    expect(value).toMatch(/^<https:\/\/[^>]+\/api\/email\/unsubscribe\?token=[^>]+>, <mailto:[^>]+>$/);
  });

  it('embeds a token that validates back to the recipient', () => {
    const headers = buildListUnsubscribeHeaders('Guest@Example.com');
    const match = headers['List-Unsubscribe'].match(/token=([^>&]+)>/);
    expect(match).not.toBeNull();

    const token = decodeURIComponent(match![1]);
    const result = validateUnsubscribeToken(token, { secret: 'test-secret-unsub' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe('guest@example.com');
    }
  });

  it('falls back to mailto-only (no one-click) when no signing secret is configured', () => {
    mockEnv.security.sessionRecoveryAccessTokenSecret = null;

    const headers = buildListUnsubscribeHeaders('guest@example.com');

    expect(headers['List-Unsubscribe']).toMatch(/^<mailto:[^>]+>$/);
    expect(headers['List-Unsubscribe-Post']).toBeUndefined();
  });

  it('returns an empty object for an unusable email', () => {
    expect(buildListUnsubscribeHeaders('   ')).toEqual({});
  });
});
