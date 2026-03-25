import { AlertCircle, Sparkles, Shield, Zap, Clock } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { GuestSignInForm } from '@/components/auth/GuestSignInForm';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in · Nab a Table',
  description: 'Access your Nab a Table guest account to manage bookings and settings.',
};

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
  error?: string | string[];
  authError?: string | string[];
  message?: string | string[];
  error_description?: string | string[];
};

type SignInPageProps = {
  searchParams: Promise<SignInPageSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = ['/guest', '/bookings', '/restaurants', '/app'] as const;
const OPS_REDIRECT_PREFIXES = [
  '/app',
  '/dashboard',
  // NOTE: /bookings is intentionally NOT included here because it's used by
  // both guest booking management (www.nabatable.com/bookings/[id]) and
  // the ops dashboard (app.nabatable.com/bookings). Guest recovery links
  // should stay on the public domain.
  '/customers',
  '/seating',
  '/settings',
  '/management',
  '/new-bookings',
] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//'))
    return undefined;

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

function resolveOpsRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//'))
    return undefined;

  const parsed = new URL(candidate, 'https://sajiloreservex.local');
  const pathname = parsed.pathname;

  const isAllowed = OPS_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return isAllowed ? candidate : undefined;
}

function isOpsRedirectTarget(target: string | undefined): boolean {
  if (!target) return false;
  return OPS_REDIRECT_PREFIXES.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}/`),
  );
}

function isAppHost(hostname: string, rootDomain: string): boolean {
  if (!hostname) return false;
  const normalizedHost = hostname.toLowerCase();
  const normalizedRoot = rootDomain.toLowerCase().replace(/^www\./, '');
  if (normalizedRoot === 'localhost') {
    return normalizedHost.startsWith('app.localhost');
  }
  return normalizedHost === `app.${normalizedRoot}`;
}

const INVALID_CLIENT_ID_SAFE_MESSAGE =
  'Sign-in is temporarily unavailable due to an authentication provider setup issue. Please contact support or try again later.';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function firstParamValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return typeof raw === 'string' ? raw : undefined;
}

function normalizeAuthMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = safeDecodeURIComponent(raw).trim();
  const parts = [decoded];

  if (decoded.startsWith('{') && decoded.endsWith('}')) {
    try {
      const parsed = JSON.parse(decoded) as {
        error?: string;
        error_description?: string;
        message?: string;
      };
      if (typeof parsed.error === 'string') parts.push(parsed.error);
      if (typeof parsed.error_description === 'string') parts.push(parsed.error_description);
      if (typeof parsed.message === 'string') parts.push(parsed.message);
    } catch {
      // Keep decoded value when payload is not valid JSON.
    }
  }

  const normalized = parts.join(' ').toLowerCase();
  if (
    normalized.includes('invalid_client_id') ||
    normalized.includes('invalid client_id parameter value')
  ) {
    return INVALID_CLIENT_ID_SAFE_MESSAGE;
  }

  return decoded;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await ensureCsrfCookie();
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? '';
  const hostname = hostHeader.replace(/:\d+$/, '');
  const hostPort = hostHeader.includes(':') ? hostHeader.split(':').pop() : undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const resolvedParams = await searchParams;
  const redirectedFromParam = resolveRedirectTarget(resolvedParams?.redirectedFrom);
  const opsRedirectedFromParam = resolveOpsRedirectTarget(resolvedParams?.redirectedFrom);
  const incomingRedirectedFrom = firstParamValue(resolvedParams?.redirectedFrom);
  const shouldStripUnsafeRedirectParam =
    typeof incomingRedirectedFrom === 'string' &&
    !redirectedFromParam &&
    !opsRedirectedFromParam;

  // Build restaurant sign-in URL for cross-subdomain navigation
  const restaurantSignInUrlBase =
    rootDomain === 'localhost'
      ? `http://app.localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
      : `https://app.${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;

  const restaurantSignInUrlObj = new URL(restaurantSignInUrlBase);
  if (opsRedirectedFromParam) {
    restaurantSignInUrlObj.searchParams.set('redirectedFrom', opsRedirectedFromParam);
  }
  const restaurantSignInUrl = restaurantSignInUrlObj.toString();

  if (!isAppHost(hostname, rootDomain) && isOpsRedirectTarget(opsRedirectedFromParam)) {
    const appHost =
      rootDomain === 'localhost'
        ? `app.localhost${hostPort ? `:${hostPort}` : ''}`
        : `app.${rootDomain.toLowerCase().replace(/^www\./, '')}`;
    const targetUrl = new URL('/auth/signin', `http://${appHost}`);
    if (rootDomain !== 'localhost') {
      targetUrl.protocol = 'https:';
    }
    if (opsRedirectedFromParam) {
      targetUrl.searchParams.set('redirectedFrom', opsRedirectedFromParam);
    }
    const forwardedError = firstParamValue(resolvedParams?.error) ?? firstParamValue(resolvedParams?.authError);
    const forwardedMessage = firstParamValue(resolvedParams?.message);
    if (forwardedError) {
      targetUrl.searchParams.set('error', forwardedError);
    }
    if (forwardedMessage) {
      targetUrl.searchParams.set('message', forwardedMessage);
    }
    redirect(targetUrl.toString());
  }

  if (shouldStripUnsafeRedirectParam) {
    const safeCurrentUrl = new URL('/auth/signin', `http://${hostHeader || 'localhost'}`);
    if (rootDomain !== 'localhost') {
      safeCurrentUrl.protocol = 'https:';
    }

    const forwardedError = firstParamValue(resolvedParams?.error) ?? firstParamValue(resolvedParams?.authError);
    const forwardedMessage = firstParamValue(resolvedParams?.message);
    if (forwardedError) {
      safeCurrentUrl.searchParams.set('error', forwardedError);
    }
    if (forwardedMessage) {
      safeCurrentUrl.searchParams.set('message', forwardedMessage);
    }

    redirect(safeCurrentUrl.toString());
  }

  // Extract error info from URL params
  const errorType =
    firstParamValue(resolvedParams?.error) ?? firstParamValue(resolvedParams?.authError);
  const forwardedErrorDescription = firstParamValue(resolvedParams?.error_description);
  const errorMessage =
    normalizeAuthMessage(firstParamValue(resolvedParams?.message)) ??
    normalizeAuthMessage(forwardedErrorDescription) ??
    (errorType === 'link_expired'
      ? 'Your magic link has expired. Please request a new one.'
      : errorType === 'link_used'
        ? 'This magic link has already been used. Please request a new one.'
        : errorType === 'missing_auth_parameters'
          ? 'Authentication callback was missing required parameters. Please try signing in again.'
          : errorType === 'pkce_mismatch'
            ? 'Authentication failed. Please use the same browser where you requested the magic link.'
            : errorType === 'invalid_client_id'
              ? INVALID_CLIENT_ID_SAFE_MESSAGE
              : errorType === 'auth_failed'
                ? 'Authentication link has expired or is invalid. Please try again.'
                : undefined);
  const hasError = !!errorType || !!errorMessage;

  // Only redirect authenticated users if there's no error
  // Using getUser() which validates the JWT with the server, not just reads cached session
  // This prevents redirect loops after logout since getSession() returns stale cached data
  if (!hasError) {
    const supabase = await getServerComponentSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Only redirect if we have a valid user AND no error
    if (user && !error) {
      const redirectTarget = redirectedFromParam ?? '/guest/dashboard';
      redirect(redirectTarget);
    }
  }

  return (
    <div className="w-full">
      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left Column - Value Proposition */}
          <div className="order-2 flex flex-col justify-center space-y-6 lg:order-1">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Seamless dining experiences
              </div>

              <h1 className="heading-hero">
                Welcome back to effortless dining
              </h1>

              <p className="text-body-warm">
                Sign in to manage your reservations, discover new restaurants, and enjoy instant
                confirmations—all from one place.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Instant confirmation</h3>
                  <p className="text-xs text-muted-foreground">Book and get confirmed in seconds</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <Clock className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Easy changes</h3>
                  <p className="text-xs text-muted-foreground">Modify or cancel anytime</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50">
                  <Shield className="h-4 w-4 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Secure & private</h3>
                  <p className="text-xs text-muted-foreground">Data protected and never shared</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="flex items-center justify-around rounded-lg border border-border bg-muted px-4 py-3">
              <div className="text-center">
                <div className="text-xl font-bold text-foreground">50K+</div>
                <div className="text-xs text-muted-foreground">Diners</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold text-foreground">200+</div>
                <div className="text-xs text-muted-foreground">Restaurants</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold text-foreground">4.9★</div>
                <div className="text-xs text-muted-foreground">Rating</div>
              </div>
            </div>
          </div>

          {/* Right Column - Sign In Form */}
          <div className="order-1 flex flex-col justify-center lg:order-2">
            {/* Error Alert */}
            {hasError && errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-6 flex items-start gap-4 rounded-2xl border border-border bg-destructive/5 text-destructive px-4 py-3"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">Unable to sign in</p>
                  <p className="text-sm opacity-90">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Sign-in Card */}
            <div className="rounded-2xl border border-border bg-background shadow-xl">
              <div className="p-6 sm:p-8">
                <GuestSignInForm redirectedFrom={redirectedFromParam} />
              </div>

              {/* Divider */}
              <div className="relative px-6 pb-6">
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="mx-4 flex-shrink text-sm text-muted-foreground">or</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>
              </div>

              {/* Restaurant Owner CTA */}
              <div className="rounded-b-2xl bg-muted px-6 pb-6">
                <p className="mb-3 text-center text-sm text-muted-foreground">
                  Are you a restaurant owner?
                </p>
                <a
                  href={restaurantSignInUrl}
                  className="flex w-full items-center justify-center rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  Sign in to operations console →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
