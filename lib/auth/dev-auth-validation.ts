import { defaultRedirectForHost, sanitizeRedirect } from '@/lib/auth/redirects';

export type DevAuthFixtureRole = 'guest' | 'owner' | 'admin';
export type DevAuthFixtureScenario = 'home' | 'auth' | 'signin';

export type DevAuthValidationResult = {
  role: DevAuthFixtureRole;
  scenario: DevAuthFixtureScenario;
  hostname: string;
  rootDomain: string;
  inputRedirectedFrom?: string;
  sanitizedRedirectedFrom?: string;
  finalDestination: string;
  notes: string[];
};

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : undefined;
}

export function resolveDevAuthFixtureRole(
  value: string | string[] | undefined,
): DevAuthFixtureRole {
  const candidate = firstValue(value);
  return candidate === 'owner' || candidate === 'admin' ? candidate : 'guest';
}

export function resolveDevAuthFixtureScenario(
  value: string | string[] | undefined,
): DevAuthFixtureScenario {
  const candidate = firstValue(value);
  return candidate === 'auth' || candidate === 'signin' ? candidate : 'home';
}

export function computeDevAuthValidationResult(input: {
  scenario: DevAuthFixtureScenario;
  role: DevAuthFixtureRole;
  redirectedFrom?: string;
  hostname: string;
  rootDomain: string;
}): DevAuthValidationResult {
  const { scenario, role, redirectedFrom, hostname, rootDomain } = input;
  const sanitizedRedirectedFrom = sanitizeRedirect(redirectedFrom, rootDomain, hostname);
  const notes: string[] = [];

  if (redirectedFrom && !sanitizedRedirectedFrom) {
    notes.push('Unsafe redirectedFrom was stripped before evaluating the destination.');
  }

  let finalDestination = defaultRedirectForHost(hostname, rootDomain);

  if (scenario === 'home') {
    finalDestination = role === 'guest' ? '/guest/dashboard' : '/app';
    notes.push('Authenticated visits to / should skip the public landing page.');
  } else if (scenario === 'auth') {
    finalDestination = role === 'guest' ? '/guest/dashboard' : '/app';
    notes.push('Authenticated visits to /auth should canonicalize to the signed-in destination.');
  } else if (role === 'guest') {
    finalDestination = sanitizedRedirectedFrom ?? '/guest/dashboard';
    notes.push('Guest sign-in returns to validated guest/public intent or falls back to dashboard.');
  } else {
    finalDestination = sanitizedRedirectedFrom ?? '/app';
    notes.push('Owner/admin sign-in returns to validated app intent or falls back to /app.');
  }

  return {
    role,
    scenario,
    hostname,
    rootDomain,
    inputRedirectedFrom: redirectedFrom,
    sanitizedRedirectedFrom: sanitizedRedirectedFrom ?? undefined,
    finalDestination,
    notes,
  };
}
