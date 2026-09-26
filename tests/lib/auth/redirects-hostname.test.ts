import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { defaultRedirectForHost, parseHostname, sanitizeRedirect } from '@/lib/auth/redirects';

describe('auth redirect hostname resolution', () => {
  it('prefers the Host header over req.nextUrl in local multi-host dev @contract @local-only', () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signin', {
      method: 'POST',
      headers: {
        host: 'app.localhost:3000',
      },
    });

    expect(parseHostname(request)).toBe('app.localhost');
  });

  it('routes ops password sign-in redirects to /dashboard, not guest dashboard @security @contract', () => {
    const hostname = 'app.localhost';
    const rootDomain = 'localhost';

    const redirectTarget =
      sanitizeRedirect('/dashboard', rootDomain, hostname) ??
      defaultRedirectForHost(hostname, rootDomain);

    expect(redirectTarget).toBe('/dashboard');
    expect(redirectTarget).not.toBe('/guest/dashboard');
  });

  it('rejects ops /app redirect targets on the root localhost host @security @contract', () => {
    const sanitized = sanitizeRedirect('/app', 'localhost', 'localhost');
    expect(sanitized).toBeUndefined();
    expect(defaultRedirectForHost('localhost', 'localhost')).toBe('/guest/dashboard');
  });

  it('documents the guest-dashboard misroute when ops host is misread as localhost @contract @local-only', () => {
    const misreadHost = 'localhost';
    const redirectedFrom = '/app';

    const redirectTarget =
      sanitizeRedirect(redirectedFrom, 'localhost', misreadHost) ??
      defaultRedirectForHost(misreadHost, 'localhost');

    expect(redirectTarget).toBe('/guest/dashboard');
  });

  it('keeps the onboarding signup confirmation redirect on the root host @contract', () => {
    // Signup sends the confirmation link with redirectedFrom=/onboarding/profile. Without
    // this the callback dropped the path and confirmed owners landed on /guest/dashboard.
    expect(sanitizeRedirect('/onboarding/profile', 'nabatable.com', 'www.nabatable.com')).toBe(
      '/onboarding/profile',
    );
    expect(sanitizeRedirect('/onboarding', 'localhost', 'localhost')).toBe('/onboarding');
    expect(sanitizeRedirect('/onboardingx', 'localhost', 'localhost')).toBeUndefined();
    // Onboarding is a root-host page; the app host keeps its ops-only allow-list.
    expect(
      sanitizeRedirect('/onboarding/profile', 'nabatable.com', 'app.nabatable.com'),
    ).toBeUndefined();
  });
});
