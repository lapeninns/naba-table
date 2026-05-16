import { AlertCircle } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { GuestSignInForm } from '@/components/auth/GuestSignInForm';
import { GuestPanel } from '@/components/guest/ui';
import { Button } from '@/components/ui/button';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in · Nab a Table',
  description:
    'Sign in with the email from your reservation to open bookings, receipts, and profile details.',
};

export const dynamic = 'force-dynamic';

type SignInPageSearchParams = {
  redirectedFrom?: string | string[];
  error?: string;
  message?: string;
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
  '/settings',
  '/new-bookings',
] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const sanitized = sanitizeLocalRedirectPath(candidate, {
    fallback: '',
    allowedPrefixes: ALLOWED_REDIRECT_PREFIXES,
  });
  if (!sanitized) {
    return undefined;
  }
  return sanitized;
}

function resolveOpsRedirectTarget(raw: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const sanitized = sanitizeLocalRedirectPath(candidate, {
    fallback: '',
    allowedPrefixes: OPS_REDIRECT_PREFIXES,
  });
  if (!sanitized) {
    return undefined;
  }
  return sanitized;
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
    if (resolvedParams?.error) {
      targetUrl.searchParams.set('error', resolvedParams.error);
    }
    if (resolvedParams?.message) {
      targetUrl.searchParams.set('message', resolvedParams.message);
    }
    redirect(targetUrl.toString());
  }

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = normalizeAuthMessage(resolvedParams?.message);
  const hasError = !!errorType;

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
    <div className="pg-container-sm flex min-h-[calc(100dvh-12rem)] items-center py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <p className="pg-kicker">Guest sign-in</p>
          <h1 className="pg-section-title">Sign in to your bookings</h1>
          <p className="pg-caption mx-auto max-w-[36ch]">
            Use the email from your reservation. We&apos;ll send a secure magic link to open
            bookings, receipts, and profile details.
          </p>
        </div>

        <GuestPanel className="overflow-hidden">
          {hasError && errorMessage ? (
            <div
              role="alert"
              aria-live="assertive"
              className="m-5 flex items-start gap-4 rounded-[var(--pg-radius-md)] border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">Unable to sign in</p>
                <p className="text-sm opacity-90">{errorMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="p-5 sm:p-6">
            <GuestSignInForm redirectedFrom={redirectedFromParam} />
          </div>

          <div className="border-t border-border bg-muted/35 p-5">
            <p className="mb-3 text-center text-sm text-muted-foreground">
              Restaurant owner or manager?
            </p>
            <Button
              asChild
              variant="guest-outline"
              size="guest-lg"
              className="pg-action pg-focus-ring pg-touch w-full"
            >
              <a href={restaurantSignInUrl}>Sign in to operations</a>
            </Button>
          </div>
        </GuestPanel>
      </div>
    </div>
  );
}
