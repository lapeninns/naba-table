import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { defaultRedirectForHost, parseHostname, sanitizeRedirect } from '@/lib/auth/redirects';

describe('auth redirect hostname resolution', () => {
  it('prefers the Host header over req.nextUrl in local multi-host dev', () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signin', {
      method: 'POST',
      headers: {
        host: 'app.localhost:3000',
      },
    });

    expect(parseHostname(request)).toBe('app.localhost');
  });

  it('routes ops password sign-in redirects to /dashboard, not guest dashboard', () => {
    const hostname = 'app.localhost';
    const rootDomain = 'localhost';

    const redirectTarget =
      sanitizeRedirect('/dashboard', rootDomain, hostname) ??
      defaultRedirectForHost(hostname, rootDomain);

    expect(redirectTarget).toBe('/dashboard');
    expect(redirectTarget).not.toBe('/guest/dashboard');
  });

  it('rejects ops /app redirect targets on the root localhost host', () => {
    const sanitized = sanitizeRedirect('/app', 'localhost', 'localhost');
    expect(sanitized).toBeUndefined();
    expect(defaultRedirectForHost('localhost', 'localhost')).toBe('/guest/dashboard');
  });

  it('documents the guest-dashboard misroute when ops host is misread as localhost', () => {
    const misreadHost = 'localhost';
    const redirectedFrom = '/app';

    const redirectTarget =
      sanitizeRedirect(redirectedFrom, 'localhost', misreadHost) ??
      defaultRedirectForHost(misreadHost, 'localhost');

    expect(redirectTarget).toBe('/guest/dashboard');
  });
});
