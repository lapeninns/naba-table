import { describe, expect, it } from 'vitest';

import { buildCsrfCookieOptions } from '@/lib/security/csrf';
import { buildSupabaseCookieOptions, resolveCookieDomain } from '@/lib/supabase/cookies';

describe('shared-platform cookie domain isolation', () => {
  it.each([
    'vercel.app',
    '.vercel.app',
    'nabatable-staging.vercel.app',
    'nabatable-staging-ops.vercel.app',
    '.nabatable-staging.vercel.app',
    ' NABATABLE-STAGING.VERCEL.APP ',
  ])('keeps auth and CSRF cookies host-only for %s', (domain) => {
    expect(resolveCookieDomain(domain)).toBeUndefined();
    const auth = buildSupabaseCookieOptions({ domain, secure: true });
    const csrf = buildCsrfCookieOptions({ rootDomain: domain, secure: true });
    expect(auth).not.toHaveProperty('domain');
    expect(csrf).not.toHaveProperty('domain');
    expect(auth).toMatchObject({ path: '/', secure: true, sameSite: 'lax', httpOnly: true });
    expect(csrf).toMatchObject({ path: '/', secure: true, sameSite: 'lax', httpOnly: false });
  });

  it.each(['nabatable.com', '.nabatable.com'])('retains production sharing for %s', (domain) => {
    expect(resolveCookieDomain(domain)).toBe('.nabatable.com');
    expect(buildSupabaseCookieOptions({ domain }).domain).toBe('.nabatable.com');
    expect(buildCsrfCookieOptions({ rootDomain: domain, secure: true }).domain).toBe(
      '.nabatable.com',
    );
  });

  it.each([undefined, null, '', 'localhost'])(
    'preserves existing host-only defaults for %s',
    (domain) => {
      expect(resolveCookieDomain(domain)).toBeUndefined();
      expect(buildSupabaseCookieOptions({ domain })).not.toHaveProperty('domain');
      expect(buildCsrfCookieOptions({ rootDomain: domain, secure: false })).not.toHaveProperty(
        'domain',
      );
    },
  );

  it.each(['notvercel.app', 'vercel.app.example.test'])(
    'does not treat lookalike %s as a platform hostname',
    (domain) => {
      expect(resolveCookieDomain(domain)).toBe(`.${domain}`);
    },
  );
});
